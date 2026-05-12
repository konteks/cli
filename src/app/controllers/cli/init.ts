import { join } from 'node:path'
import type { EmbeddingProviderContract } from '@/app/contracts/services/embedding-provider'
import { ensureProjectDatabase } from '@/app/database/sqlite/database'
import type { MineProjectResponse } from '@/app/dto/application/mine-project'
import type { GlobalCliOptions } from '@/app/dto/cli/options'
import {
    createDefaultConfig,
    loadProjectContext,
} from '@/app/file-system/context'
import { createMiningAction } from '@/app/mining/create-mining-action'
import { readMineManifest } from '@/app/mining/engine/manifest'
import { createMineProgressReporter } from '@/app/mining/progress-reporter'
import { mkdir, readFile, writeFile } from '@/app/support/file-manager'
import { terminal } from '@/app/support/terminal'

type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProviderContract
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
    const context = await loadProjectContext(options.project)
    if (context.configExists && (await readMineManifest(context.memoryDir))) {
        terminal.log(
            `Konteks is already initialized at ${context.memoryDir}. Use 'konteks repair' if memory artifacts need recovery.`,
        )
        return
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
    let extraction: MineProjectResponse
    try {
        const action = createMiningAction({
            embeddingProvider: options.embeddingProvider,
            onProgress: progress.report,
        })

        extraction = await action.execute({
            mode: context.configExists ? 'resume' : 'full',
            projectRoot: context.projectRoot,
        })
    } finally {
        progress.done()
    }

    terminal.log(`Initialized Konteks at ${context.memoryDir}`)
    terminal.log(
        `Extracted ${extraction.fileCount} files into ${extraction.chunkCount} sections`,
    )
}

export async function ensureKonteksGitignore(
    projectRoot: string,
): Promise<void> {
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
