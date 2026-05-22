import { eq, sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import deleteRetrievalDocuments from '@/database/actions/delete-retrieval-documents'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import { modules, targetEmbeddings } from '@/database/schema'
import { contentHash } from '@/providers/persistence/objects/content'
import type {
    PackageManifestMetadata,
    ProjectMetadata,
} from './extract-project-metadata'

type ModuleSummaryRow = {
    section_count: number
    file_count: number
    module_path: string
    source_role: string | null
}

export default async function rebuildModuleArtifacts(
    extractedAt: string,
    metadata?: ProjectMetadata,
): Promise<void> {
    const db = await getDb()
    await deleteRetrievalDocuments('module')
    await db
        .delete(targetEmbeddings)
        .where(eq(targetEmbeddings.targetType, 'module'))
    await db.delete(modules)

    const rows = await db.all<ModuleSummaryRow>(sql`
select
    case
        when instr(path, '/') > 0 then substr(path, 1, instr(path, '/') - 1)
        else '.'
    end as module_path,
    coalesce(source_role, 'unknown') as source_role,
    count(distinct path) as file_count,
    count(*) as section_count
from sections
where deleted_at is null
  and suppressed_at is null
group by module_path, source_role
order by section_count desc, module_path
`)

    for (const row of rows) {
        const moduleId = `module_${contentHash(`${row.module_path}:${row.source_role ?? 'unknown'}`).slice(0, 32)}`
        const summary = summarizeModule(row)
        const topics = moduleTopics(row.module_path)

        await db.insert(modules).values({
            entitiesJson: JSON.stringify([]),
            exportedSymbolsJson: JSON.stringify([]),
            fileCount: row.file_count,
            id: moduleId,
            importsJson: JSON.stringify([]),
            packageName: null,
            path: row.module_path,
            sectionCount: row.section_count,
            sourceRole: row.source_role,
            summary,
            topicsJson: JSON.stringify(topics),
            updatedAt: extractedAt,
        })

        const ftsText = [
            `module: ${row.module_path}`,
            `role: ${row.source_role ?? 'unknown'}`,
            `summary: ${summary}`,
            `topics: ${topics.join(', ')}`,
        ].join('\n')

        await upsertRetrievalDocument({
            anchor: row.module_path,
            embeddingText: ftsText,
            ftsText,
            path: row.module_path,
            sourceRole: row.source_role ?? 'unknown',
            summary,
            targetId: moduleId,
            targetType: 'module',
            updatedAt: extractedAt,
        })
    }

    if (metadata && (metadata.packageManifests ?? []).length > 0) {
        await insertPackageModule(metadata, extractedAt)
    }
}

function summarizeModule(row: ModuleSummaryRow): string {
    return `${row.file_count} files, ${row.section_count} sections`
}

function moduleTopics(path: string): string[] {
    return path
        .split(/[/._-]+/u)
        .map(part => part.toLowerCase())
        .filter(part => part.length > 2)
        .slice(0, 8)
}

async function insertPackageModule(
    metadata: ProjectMetadata,
    extractedAt: string,
): Promise<void> {
    const db = await getDb()
    const packageManifests = metadata.packageManifests ?? []
    const primaryManifest = packageManifests[0]
    if (!primaryManifest) {
        return
    }
    const dependencyNames = [
        ...metadata.dependencies,
        ...metadata.devDependencies,
        ...metadata.peerDependencies,
        ...metadata.optionalDependencies,
    ].slice(0, 80)
    const modulePath = primaryManifest.path
    const managers = manifestManagers(packageManifests)
    const moduleId = `module_${contentHash(`package:${modulePath}:${metadata.name ?? ''}`).slice(0, 32)}`
    const summary = `${managers.join(', ')}, ${dependencyNames.length} deps`
    const topics = [
        'package',
        metadata.name,
        ...managers,
        metadata.workspaceManager,
        ...dependencyNames.slice(0, 24),
    ].filter((value): value is string => Boolean(value))

    await db.insert(modules).values({
        entitiesJson: JSON.stringify([]),
        exportedSymbolsJson: JSON.stringify([]),
        fileCount: 1,
        id: moduleId,
        importsJson: JSON.stringify(dependencyNames),
        packageName: metadata.name ?? null,
        path: modulePath,
        sectionCount: 0,
        sourceRole: 'package_config',
        summary,
        topicsJson: JSON.stringify(topics),
        updatedAt: extractedAt,
    })

    const text = [
        `module: ${modulePath}`,
        'role: package_config',
        metadata.name ? `package: ${metadata.name}` : '',
        metadata.packageManager
            ? `package manager: ${metadata.packageManager}`
            : '',
        packageManifests.length > 1
            ? `package manifests: ${packageManifests.map(manifest => `${manifest.path} (${manifest.manager})`).join(', ')}`
            : '',
        metadata.workspaceManager
            ? `workspace manager: ${metadata.workspaceManager}`
            : '',
        metadata.workspaceGlobs.length > 0
            ? `workspace globs: ${metadata.workspaceGlobs.join(', ')}`
            : '',
        dependencyNames.length > 0
            ? `dependencies: ${dependencyNames.join(', ')}`
            : '',
        `summary: ${summary}`,
    ]
        .filter(Boolean)
        .join('\n')

    await upsertRetrievalDocument({
        anchor: modulePath,
        embeddingText: text,
        ftsText: text,
        path: modulePath,
        sourceRole: 'package_config',
        summary,
        targetId: moduleId,
        targetType: 'module',
        updatedAt: extractedAt,
    })
}

function manifestManagers(manifests: PackageManifestMetadata[]): string[] {
    return [...new Set(manifests.map(manifest => manifest.manager))].sort(
        (left, right) => left.localeCompare(right),
    )
}
