import { withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import reindexRetrievalDocumentFts from '@/database/actions/reindex-retrieval-document-fts'
import { upsertNode } from '@/database/services/taxonomy'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import { terminal } from '@/support/terminal/service'
import type { ExtractionProgressReporter } from '@/types/progress'
import type { Project } from '@/types/project'
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
    sectionCount: number
    filesTruncatedBySectionLimit: number
    loadedParserCount: number
    parserFallbackFiles: number
    parserUsedFiles: number
}

export default async function extractSections(
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
            phase: 'sections',
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
            phase: 'sections',
            status: 'progress',
        })
    }

    await options.beforeExtract?.()

    let sectionCount = 0
    let filesTruncatedBySectionLimit = 0
    let extractedFileCount = 0
    let parserFallbackFiles = 0
    let parserUsedFiles = 0

    let rootNodeId = ''
    progress?.({
        message: 'Preparing extraction tables',
        phase: 'database',
        status: 'progress',
    })
    await withTransaction(async () => {
        if (options.mode === 'changed') {
            await clearExtractedSectionsForPaths([
                ...files.map(file => file.path),
                ...(options.deletedPaths ?? []),
            ])
        } else if (options.mode !== 'resume') {
            await clearExtractedSections()
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
            phase: 'sections',
            status: 'start',
            total: files.length,
        })
    }
    for (const [fileIndex, file] of files.entries()) {
        const preparedFile = await prepareFileSections({
            context,
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
            filesTruncatedBySectionLimit += 1
        }
        if (preparedFile.sections.length === 0) {
            continue
        }

        extractedFileCount += 1
        await withTransaction(async () => {
            sectionCount += await persistPreparedFileSections({
                extractedAt,
                preparedFile,
                rootNodeId,
            })
        })
        progress?.({
            current: fileIndex + 1,
            message: `Extracted ${file.path} (${preparedFile.sections.length} sections)`,
            path: file.path,
            phase: 'sections',
            sectionCount: sectionCount,
            status: 'progress',
            total: files.length,
        })
    }

    if (files.length > 0) {
        progress?.({
            current: extractedFileCount,
            message: `Extracted ${sectionCount} sections`,
            parserCount: loadedParserCount,
            phase: 'sections',
            sectionCount: sectionCount,
            status: 'done',
            total: files.length,
        })
    }
    progress?.({
        message: 'Rebuilding module artifacts and retrieval index',
        phase: 'modules',
        status: 'start',
    })
    await withTransaction(async () => {
        await rebuildModuleArtifacts(extractedAt, options.metadata)
        await reindexRetrievalDocumentFts()

        await appendMemoryEvent({
            actor: 'cli',
            eventType: 'project_extracted',
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
        filesTruncatedBySectionLimit,
        loadedParserCount,
        parserFallbackFiles,
        parserUsedFiles,
        sectionCount: sectionCount,
    }
}
