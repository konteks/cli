import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EmbeddingProviderContract } from '@/app/contracts/services/embedding-provider'
import type { MineProjectResponse } from '@/app/models/mining'
import { readMineManifest } from '@/app/providers/extraction/engine/manifest'
import { createMineProgressReporter } from '@/app/providers/extraction/progress-reporter'
import { ensureProjectDatabase } from '@/app/providers/persistence/sqlite/database'
import {
    createDefaultConfig,
    loadProjectContext,
} from '@/app/providers/project/context'
import { createMiningAction } from './mining'

export type InitializeProjectOptions = {
    embeddingProvider?: EmbeddingProviderContract
    project?: string
}

export type InitializeProjectResult =
    | {
          alreadyInitialized: true
          memoryDir: string
      }
    | {
          alreadyInitialized: false
          extraction: MineProjectResponse
          memoryDir: string
      }

export async function initializeProject(
    options: InitializeProjectOptions,
): Promise<InitializeProjectResult> {
    const context = await loadProjectContext(options.project)
    if (context.configExists && (await readMineManifest(context.memoryDir))) {
        return {
            alreadyInitialized: true,
            memoryDir: context.memoryDir,
        }
    }

    await mkdir(context.memoryDir, { recursive: true })
    await mkdir(join(context.memoryDir, 'objects'), { recursive: true })

    await writeFile(
        context.configPath,
        `${JSON.stringify(createDefaultConfig(context.projectRoot), null, 2)}\n`,
        { flag: 'wx' },
    ).catch(async error => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error
        }
    })
    await ensureProjectDatabase(await loadProjectContext(options.project))
    await ensureKonteksGitignore(context.projectRoot)

    const progress = createMineProgressReporter()
    try {
        const action = createMiningAction({
            embeddingProvider: options.embeddingProvider,
            onProgress: progress.report,
        })

        const extraction = await action.execute({
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
