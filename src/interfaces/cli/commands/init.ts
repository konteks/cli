import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider.js'
import { HuggingFaceEmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider.js'
import {
    createDefaultConfig,
    loadProjectContext,
} from '@/infrastructure/file-system/context.js'
import { readMineManifest } from '@/infrastructure/mining/manifest.js'
import { mineProject } from '@/infrastructure/mining/mine-project.js'
import { ensureProjectDatabase } from '@/infrastructure/persistence/sqlite/database.js'
import type { GlobalCliOptions } from '../options.js'
import { createMineProgressReporter } from './mine.js'

type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProvider
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
    const context = await loadProjectContext(options.project)
    if (context.configExists && (await readMineManifest(context.memoryDir))) {
        console.log(
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
    let extraction: Awaited<ReturnType<typeof mineProject>>
    try {
        const embeddingProvider =
            options.embeddingProvider ??
            new HuggingFaceEmbeddingProvider({
                onProgress: progress.report,
            })
        extraction = await mineProject(
            await loadProjectContext(options.project),
            context.configExists ? 'resume' : 'full',
            {
                embeddingProvider,
                onProgress: progress.report,
            },
        )
    } finally {
        progress.done()
    }

    console.log(`Initialized Konteks at ${context.memoryDir}`)
    console.log(
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
