import type { SqliteConnection } from '@/database/actions/_db'
import { contentHash } from '@/providers/persistence/objects/content'
import {
    executeSql,
    querySql,
} from '@/providers/persistence/sqlite/libsql-helpers'
import {
    deleteRetrievalDocuments,
    upsertRetrievalDocument,
} from '@/providers/persistence/sqlite/retrieval-documents'
import type {
    PackageManifestMetadata,
    ProjectMetadata,
} from './extract-project-metadata'

type ModuleSummaryRow = {
    chunk_count: number
    file_count: number
    module_path: string
    source_role: string | null
}

export default async function rebuildModuleArtifacts(
    db: SqliteConnection,
    extractedAt: string,
    metadata?: ProjectMetadata,
): Promise<void> {
    await deleteRetrievalDocuments(db, 'module')
    await executeSql(
        db.client,
        'delete from target_embeddings where target_type = ?',
        ['module'],
    )
    await executeSql(db.client, 'delete from modules')

    const rows = await querySql<ModuleSummaryRow>(
        db.client,
        `
select
    case
        when instr(path, '/') > 0 then substr(path, 1, instr(path, '/') - 1)
        else '.'
    end as module_path,
    coalesce(source_role, 'unknown') as source_role,
    count(distinct path) as file_count,
    count(*) as chunk_count
from chunks
where deleted_at is null
  and suppressed_at is null
group by module_path, source_role
order by chunk_count desc, module_path
`,
    )

    for (const row of rows) {
        const moduleId = `module_${contentHash(`${row.module_path}:${row.source_role ?? 'unknown'}`).slice(0, 32)}`
        const summary = summarizeModule(row)
        const topics = moduleTopics(row.module_path)

        await executeSql(
            db.client,
            `
insert into modules (
    id,
    path,
    source_role,
    package_name,
    summary,
    file_count,
    chunk_count,
    exported_symbols_json,
    imports_json,
    topics_json,
    entities_json,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                moduleId,
                row.module_path,
                row.source_role,
                null,
                summary,
                row.file_count,
                row.chunk_count,
                JSON.stringify([]),
                JSON.stringify([]),
                JSON.stringify(topics),
                JSON.stringify([]),
                extractedAt,
            ],
        )

        const ftsText = [
            `module: ${row.module_path}`,
            `role: ${row.source_role ?? 'unknown'}`,
            `summary: ${summary}`,
            `topics: ${topics.join(', ')}`,
        ].join('\n')

        await upsertRetrievalDocument(db, {
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
        await insertPackageModule(db, metadata, extractedAt)
    }
}

function summarizeModule(row: ModuleSummaryRow): string {
    return `${row.file_count} files, ${row.chunk_count} sections`
}

function moduleTopics(path: string): string[] {
    return path
        .split(/[/._-]+/u)
        .map(part => part.toLowerCase())
        .filter(part => part.length > 2)
        .slice(0, 8)
}

async function insertPackageModule(
    db: SqliteConnection,
    metadata: ProjectMetadata,
    extractedAt: string,
): Promise<void> {
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

    await executeSql(
        db.client,
        `
insert into modules (
    id,
    path,
    source_role,
    package_name,
    summary,
    file_count,
    chunk_count,
    exported_symbols_json,
    imports_json,
    topics_json,
    entities_json,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
        [
            moduleId,
            modulePath,
            'package_config',
            metadata.name ?? null,
            summary,
            1,
            0,
            JSON.stringify([]),
            JSON.stringify(dependencyNames),
            JSON.stringify(topics),
            JSON.stringify([]),
            extractedAt,
        ],
    )

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

    await upsertRetrievalDocument(db, {
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
