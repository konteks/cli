import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import { reindexRetrievalDocumentFts } from '@/providers/persistence/sqlite/retrieval-documents'
import { terminal } from '@/support/terminal/service'
import type { ProjectMetadata } from './extract-project-metadata'
import type { ScannedFile } from './file-scan'
import { initTreeSitterWithSelectedGrammars } from './grammar-loader'
import persistPreparedFileSections from './persist-prepared-file-sections'
import prepareFileSections from './prepare-file-sections'
import rebuildModuleArtifacts from './rebuild-module-artifacts'
import {
    clearExtractedSections,
    clearExtractedSectionsForPaths,
} from './section-cleanup'
import TreeSitterEngine from './tree-sitter-engine'

type ExtractSectionsResult = {
    chunkCount: number
    filesTruncatedByChunkLimit: number
    parserFallbackFiles: number
    parserUsedFiles: number
}

export default async function extractSections(
    db: DatabaseService,
    context: Project,
    files: ScannedFile[],
    extractedAt: string,
    options: {
        deletedPaths?: string[]
        metadata?: ProjectMetadata
        mode?: 'changed' | 'full' | 'reindex' | 'resume'
        onProgress?: ExtractionProgressReporter
        treeSitterEngine?: TreeSitterEngine
    } = {},
): Promise<ExtractSectionsResult> {
    const progress = options.onProgress
    const toonStore = createToonStore(context.memoryDir)
    let engine: TreeSitterEngine | undefined

    if (files.length > 0) {
        progress?.({
            message: 'Loading Tree-sitter grammars',
            phase: 'chunks',
            status: 'start',
        })
        engine = options.treeSitterEngine ?? new TreeSitterEngine()
        const loaded = await initTreeSitterWithSelectedGrammars(
            engine,
            context,
            { onProgress: progress },
        )
        if (loaded.loaded.length === 0 && !options.treeSitterEngine) {
            engine = undefined
        }
        for (const warning of loaded.warnings) {
            terminal.error(warning)
        }
        progress?.({
            message: 'Tree-sitter grammars ready',
            phase: 'chunks',
            status: 'progress',
        })
    }

    let sectionCount = 0
    let filesTruncatedByChunkLimit = 0
    let parserFallbackFiles = 0
    let parserUsedFiles = 0

    let rootNodeId = ''
    progress?.({
        message: 'Preparing extraction tables',
        phase: 'database',
        status: 'progress',
    })
    await db.transaction(async tx => {
        if (options.mode === 'changed') {
            await clearExtractedSectionsForPaths(tx, [
                ...files.map(file => file.path),
                ...(options.deletedPaths ?? []),
            ])
        } else if (options.mode !== 'resume') {
            await clearExtractedSections(tx)
        }
        const rootNode = await tx.taxonomy.upsertNode({
            name: 'Project Files',
            summary: 'Files extracted from the current project.',
        })
        rootNodeId = rootNode.id
    })

    if (files.length > 0) {
        progress?.({
            message: `Extracting ${files.length} files`,
            phase: 'chunks',
            status: 'start',
            total: files.length,
        })
    }
    for (const [fileIndex, file] of files.entries()) {
        const preparedFile = await prepareFileSections({
            context,
            db,
            engine,
            file,
            toonStore,
        })

        if (
            preparedFile.parserEngine === 'tree_sitter' &&
            preparedFile.parserStatus === 'ok'
        ) {
            parserUsedFiles += 1
        } else if (
            preparedFile.sections.some(section => section.kind === 'code')
        ) {
            parserFallbackFiles += 1
        }

        if (preparedFile.truncated) {
            filesTruncatedByChunkLimit += 1
        }
        if (preparedFile.sections.length === 0) {
            continue
        }

        await db.transaction(async tx => {
            sectionCount += await persistPreparedFileSections({
                db: tx,
                extractedAt,
                preparedFile,
                rootNodeId,
                taxonomy: tx.taxonomy,
            })
        })
        progress?.({
            chunkCount: sectionCount,
            current: fileIndex + 1,
            message: `Extracted ${file.path} (${preparedFile.sections.length} sections)`,
            path: file.path,
            phase: 'chunks',
            status: 'progress',
            total: files.length,
        })
    }

    if (files.length > 0) {
        progress?.({
            chunkCount: sectionCount,
            message: `Extracted ${sectionCount} sections`,
            phase: 'chunks',
            status: 'done',
            total: files.length,
        })
    }
    progress?.({
        message: 'Rebuilding module artifacts and retrieval index',
        phase: 'modules',
        status: 'start',
    })
    await db.transaction(async tx => {
        await rebuildModuleArtifacts(tx, extractedAt, options.metadata)
        await reindexRetrievalDocumentFts(tx)

        await tx.events.append({
            actor: 'cli',
            eventType: 'project_mined',
            id: `event_${contentHash(`${context.projectRoot}:${extractedAt}`).slice(0, 32)}`,
            subjectType: 'project',
            summary: `Extracted ${files.length} files into ${sectionCount} sections.`,
        })
    })
    progress?.({
        message: 'Module artifacts and retrieval index ready',
        phase: 'modules',
        status: 'done',
    })

    return {
        chunkCount: sectionCount,
        filesTruncatedByChunkLimit,
        parserFallbackFiles,
        parserUsedFiles,
    }
}
