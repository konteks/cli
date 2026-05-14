import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import { createProjectExtractor } from '@/extraction/extract'
import type { ExtractProjectResponse } from '@/models/extraction'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { createExtractionProgressReporter } from '@/providers/extraction/progress-reporter'
import { ensureProjectDatabase } from '@/providers/persistence/sqlite/database'
import {
    createDefaultConfig,
    loadProjectContext,
} from '@/providers/project/context'

export type InitializeProjectOptions = {
    embeddingProvider?: EmbeddingProviderContract
    grammars?: string[]
    project?: string
}

export type InitializeProjectResult =
    | {
          alreadyInitialized: true
          memoryDir: string
      }
    | {
          alreadyInitialized: false
          extraction: ExtractProjectResponse
          memoryDir: string
      }

export async function initializeProject(
    options: InitializeProjectOptions,
): Promise<InitializeProjectResult> {
    const context = await loadProjectContext(options.project)
    if (
        context.configExists &&
        (await readExtractionManifest(context.memoryDir))
    ) {
        return {
            alreadyInitialized: true,
            memoryDir: context.memoryDir,
        }
    }

    await mkdir(context.memoryDir, { recursive: true })
    await mkdir(join(context.memoryDir, 'objects'), { recursive: true })

    const defaultConfig = createDefaultConfig(context.projectRoot)
    await writeFile(
        context.configPath,
        `${JSON.stringify(
            {
                ...defaultConfig,
                extraction: {
                    grammars: {
                        ...defaultConfig.extraction.grammars,
                        selected: options.grammars ?? [],
                    },
                },
            },
            null,
            2,
        )}\n`,
        { flag: 'wx' },
    ).catch(async error => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error
        }
    })
    await ensureProjectDatabase(await loadProjectContext(options.project))
    await ensureKonteksGitignore(context.projectRoot)

    const progress = createExtractionProgressReporter()
    try {
        const extractor = createProjectExtractor({
            embeddingProvider: options.embeddingProvider,
            onProgress: progress.report,
        })

        const extraction = await extractor.execute({
            mode: context.configExists ? 'resume' : 'full',
            projectRoot: context.projectRoot,
        })

        return {
            alreadyInitialized: false,
            extraction,
            memoryDir: context.memoryDir,
        }
    } finally {
        progress.done()
    }
}

async function ensureKonteksGitignore(projectRoot: string): Promise<void> {
    const gitignorePath = join(projectRoot, '.gitignore')
    const existing = await readFile(gitignorePath, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return ''
        }

        throw error
    })

    if (hasKonteksIgnoreEntry(existing)) {
        return
    }

    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
    await writeFile(gitignorePath, `${existing}${prefix}.konteks/\n`)
}

function hasKonteksIgnoreEntry(content: string): boolean {
    return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .some(line => line === '.konteks' || line === '.konteks/')
}
