import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import { type SqliteConnection, withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import { upsertNode } from '@/database/services/taxonomy'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
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
    loadedParserCount: number
    parserFallbackFiles: number
    parserUsedFiles: number
}

export default async function extractSections(
    db: SqliteConnection,
    context: Project,
    files: ScannedFile[],
    extractedAt: string,
    options: {
        beforeExtract?: () => Promise<void>
        deletedPaths?: string[]
        metadata?: ProjectMetadata
        mode?: 'changed' | 'full' | 'reindex' | 'resume'
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<ExtractSectionsResult> {
    const progress = options.onProgress
    const toonStore = createToonStore(context.memoryDir)
    let engine: TreeSitterEngine | undefined
    let loadedParserCount = 0

    if (files.length > 0) {
        progress?.({
            message: 'Loading Tree-sitter grammars',
            phase: 'chunks',
            status: 'start',
        })
        engine = new TreeSitterEngine()
        const loaded = await initTreeSitterWithSelectedGrammars(
            engine,
            context,
            {
                onProgress: progress,
                paths: files.map(file => file.path),
            },
        )
        if (loaded.loaded.length === 0) {
            engine = undefined
        }
        loadedParserCount = loaded.loaded.length
        for (const warning of loaded.warnings) {
            terminal.error(warning)
        }
        progress?.({
            message: 'Tree-sitter grammars ready',
            phase: 'chunks',
            status: 'progress',
        })
    }

    await options.beforeExtract?.()

    let sectionCount = 0
    let filesTruncatedByChunkLimit = 0
    let extractedFileCount = 0
    let parserFallbackFiles = 0
    let parserUsedFiles = 0

    let rootNodeId = ''
    progress?.({
        message: 'Preparing extraction tables',
        phase: 'database',
        status: 'progress',
    })
    await withTransaction(db, async tx => {
        if (options.mode === 'changed') {
            await clearExtractedSectionsForPaths(tx, [
                ...files.map(file => file.path),
                ...(options.deletedPaths ?? []),
            ])
        } else if (options.mode !== 'resume') {
            await clearExtractedSections(tx)
        }
        const rootNode = await upsertNode({
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

        extractedFileCount += 1
        await withTransaction(db, async tx => {
            sectionCount += await persistPreparedFileSections({
                db: tx,
                extractedAt,
                preparedFile,
                rootNodeId,
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
            current: extractedFileCount,
            message: `Extracted ${sectionCount} sections`,
            parserCount: loadedParserCount,
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
    await withTransaction(db, async tx => {
        await rebuildModuleArtifacts(tx, extractedAt, options.metadata)
        await reindexRetrievalDocumentFts(tx)

        await appendMemoryEvent({
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
        loadedParserCount,
        parserFallbackFiles,
        parserUsedFiles,
    }
}
