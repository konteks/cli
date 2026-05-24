import { eq } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import deleteRetrievalDocuments from '@/database/actions/delete-retrieval-documents'
import queryMetadataFileRows from '@/database/actions/query-metadata-file-rows'
import queryModuleFileRows from '@/database/actions/query-module-file-rows'
import queryModuleSummaryRows, {
    type ModuleSummaryRow,
} from '@/database/actions/query-module-summary-rows'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import { modules, targetEmbeddings } from '@/database/schema'
import {
    aliasesForCommand,
    aliasesForPackage,
    aliasesForPath,
    deleteExtractedModuleGraph,
    entityIdFor,
    upsertEntity,
    upsertEntityAliases,
    upsertRelation,
} from '@/database/services/graph'
import contentHash from '@/support/content-hash'
import type {
    PackageManifestMetadata,
    ProjectMetadata,
} from './extract-project-metadata'

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
    await deleteExtractedModuleGraph()

    const rows = await queryModuleSummaryRows()

    for (const row of rows) {
        const moduleId = `module_${contentHash(`${row.module_path}:${row.source_role ?? 'unknown'}`).slice(0, 32)}`
        const summary = summarizeModule(row)
        const topics = moduleTopics(row.module_path)
        const moduleEntity = await upsertModuleEntity({
            moduleId,
            path: row.module_path,
            sourceRole: row.source_role ?? 'unknown',
            summary,
        })

        await db.insert(modules).values({
            entitiesJson: JSON.stringify([moduleEntity.id]),
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
        await upsertModuleContainsFileRelations(row, moduleEntity.id)
    }

    if (metadata && (metadata.packageManifests ?? []).length > 0) {
        await insertPackageModule(metadata, extractedAt)
    }
    if (metadata) {
        await upsertMetadataGraph(metadata)
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
    const moduleEntity = await upsertModuleEntity({
        moduleId,
        path: modulePath,
        sourceRole: 'package_config',
        summary,
    })
    const topics = [
        'package',
        metadata.name,
        ...managers,
        metadata.workspaceManager,
        ...dependencyNames.slice(0, 24),
    ].filter((value): value is string => Boolean(value))

    await db.insert(modules).values({
        entitiesJson: JSON.stringify([moduleEntity.id]),
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

async function upsertMetadataGraph(metadata: ProjectMetadata): Promise<void> {
    const packageModulePath =
        metadata.packagePath ?? metadata.packageManifests[0]?.path
    const packageModuleEntity = packageModulePath
        ? entityIdForModulePath(packageModulePath, 'package_config')
        : undefined
    const projectPackage = await upsertProjectPackage(metadata)
    const dependencyPackages = await upsertDependencyPackages(metadata)

    for (const dependency of dependencyPackages) {
        if (projectPackage) {
            await upsertRelation({
                evidenceKey: `${projectPackage.id}:${dependency.id}:uses_package`,
                objectId: dependency.id,
                predicate: 'uses_package',
                properties: {
                    origin: 'extraction',
                    packageName: dependency.name,
                },
                subjectId: projectPackage.id,
            })
        }
        if (packageModuleEntity) {
            await upsertRelation({
                evidenceKey: `${packageModuleEntity}:${dependency.id}:contains`,
                objectId: dependency.id,
                predicate: 'contains',
                properties: {
                    origin: 'extraction',
                    packageName: dependency.name,
                },
                subjectId: packageModuleEntity,
            })
        }
    }

    if (projectPackage && packageModuleEntity) {
        await upsertRelation({
            evidenceKey: `${packageModuleEntity}:${projectPackage.id}:contains`,
            objectId: projectPackage.id,
            predicate: 'contains',
            properties: {
                origin: 'extraction',
                packageName: projectPackage.name,
            },
            subjectId: packageModuleEntity,
        })
    }
    if (projectPackage) {
        await upsertCommandEntities(metadata, projectPackage.id)
    }

    await upsertConfigAndDocEntities()
}

async function upsertProjectPackage(metadata: ProjectMetadata) {
    const manifest = metadata.packageManifests.find(item => item.name)
    const name = metadata.name ?? manifest?.name
    if (!name) {
        return undefined
    }

    const entity = await upsertEntity({
        canonicalName: `package:${name}`,
        name,
        properties: {
            manager: manifest?.manager ?? metadata.packageManager,
            origin: 'extraction',
            packageName: name,
            path: manifest?.path ?? metadata.packagePath,
        },
        summary: metadata.description ?? `Project package ${name}`,
        type: 'package',
    })
    await upsertEntityAliases(
        entity.id,
        aliasesForPackage(name, manifest?.manager ?? metadata.packageManager),
    )
    return entity
}

async function upsertDependencyPackages(
    metadata: ProjectMetadata,
): Promise<Array<{ id: string; name: string }>> {
    const names = [
        ...metadata.dependencies,
        ...metadata.devDependencies,
        ...metadata.peerDependencies,
        ...metadata.optionalDependencies,
    ]
    const uniqueNames = [...new Set(names)].sort((left, right) =>
        left.localeCompare(right),
    )
    const packages: Array<{ id: string; name: string }> = []

    for (const name of uniqueNames) {
        const entity = await upsertEntity({
            canonicalName: `package:${name}`,
            name,
            properties: {
                origin: 'extraction',
                packageName: name,
            },
            summary: `Dependency package ${name}`,
            type: 'package',
        })
        await upsertEntityAliases(entity.id, aliasesForPackage(name))
        packages.push({ id: entity.id, name })
    }

    return packages
}

async function upsertCommandEntities(
    metadata: ProjectMetadata,
    projectPackageId: string,
): Promise<void> {
    for (const scriptName of metadata.scripts) {
        const entity = await upsertEntity({
            canonicalName: `command:${scriptName}`,
            name: scriptName,
            properties: {
                origin: 'extraction',
                scriptName,
            },
            summary: `Package script ${scriptName}`,
            type: 'command',
        })
        await upsertEntityAliases(
            entity.id,
            aliasesForCommand(scriptName, metadata.packageManager),
        )
        await upsertRelation({
            evidenceKey: `${entity.id}:${projectPackageId}:uses_package`,
            objectId: projectPackageId,
            predicate: 'uses_package',
            properties: {
                origin: 'extraction',
                scriptName,
            },
            subjectId: entity.id,
        })
    }
}

async function upsertConfigAndDocEntities(): Promise<void> {
    const rows = await queryMetadataFileRows()

    for (const row of rows) {
        const type = row.source_role === 'product_doc' ? 'doc' : 'config'
        const entity = await upsertEntity({
            canonicalName: `${type}:${row.path}`,
            name: row.path.split('/').at(-1) ?? row.path,
            properties: {
                origin: 'extraction',
                path: row.path,
                sourceRole: row.source_role,
            },
            summary: `${row.source_role} file ${row.path}`,
            type,
        })
        await upsertEntityAliases(entity.id, aliasesForPath(row.path))
        await upsertRelation({
            evidenceKey: `${entityIdForModulePath(row.path, row.source_role)}:${entity.id}:contains`,
            objectId: entity.id,
            predicate: 'contains',
            properties: {
                origin: 'extraction',
                path: row.path,
                sourceRole: row.source_role,
            },
            subjectId: entityIdForModulePath(row.path, row.source_role),
        })
    }
}

async function upsertModuleEntity(input: {
    moduleId: string
    path: string
    sourceRole: string
    summary: string
}) {
    const entity = await upsertEntity({
        canonicalName: `${input.path}:${input.sourceRole}`,
        name: input.path,
        properties: {
            moduleId: input.moduleId,
            modulePath: input.path,
            origin: 'extraction',
            sourceRole: input.sourceRole,
        },
        summary: input.summary,
        type: 'module',
    })
    await upsertEntityAliases(entity.id, [
        input.path,
        `${input.path}:${input.sourceRole}`,
        ...aliasesForPath(input.path),
    ])
    return entity
}

async function upsertModuleContainsFileRelations(
    row: ModuleSummaryRow,
    moduleEntityId: string,
): Promise<void> {
    const fileRows = await queryModuleFileRows({
        modulePath: row.module_path,
        sourceRole: row.source_role,
    })

    for (const file of fileRows) {
        const fileEntity = await upsertEntity({
            canonicalName: file.path,
            name: file.path.split('/').at(-1) ?? file.path,
            properties: {
                origin: 'extraction',
                path: file.path,
                sourceRole: file.source_role,
            },
            summary: `${file.source_role} file ${file.path}`,
            type: 'file',
        })
        await upsertEntityAliases(fileEntity.id, aliasesForPath(file.path))
        await upsertRelation({
            evidenceKey: `${moduleEntityId}:${fileEntity.id}:contains`,
            objectId: fileEntity.id,
            predicate: 'contains',
            properties: {
                filePath: file.path,
                modulePath: row.module_path,
                origin: 'extraction',
                sourceRole: row.source_role ?? 'unknown',
            },
            subjectId: moduleEntityId,
        })
    }
}

function manifestManagers(manifests: PackageManifestMetadata[]): string[] {
    return [...new Set(manifests.map(manifest => manifest.manager))].sort(
        (left, right) => left.localeCompare(right),
    )
}

function entityIdForModulePath(path: string, sourceRole: string): string {
    const modulePath = path.includes('/') ? (path.split('/').at(0) ?? '.') : '.'
    return entityIdFor('module', `${modulePath}:${sourceRole}`)
}
