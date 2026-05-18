import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import BaseCommand from '@/commands/_base-command'
import createInitProgressReporter from '@/commands/init-command/utils/init-progress-reporter'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import createProjectExtractor from '@/extraction/create-project-extractor'
import type { ExtractProjectResponse } from '@/models/extraction'
import type { Project } from '@/models/project'
import { reviewDetectedGrammars } from '@/providers/cli/grammar-selection'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { ensureProjectDatabase } from '@/providers/persistence/sqlite/database'
import {
    createDefaultConfig,
    loadProjectContext,
} from '@/providers/project/context'

export default class InitCommand extends BaseCommand {
    public readonly description =
        'Initialize memory, section the project, and build indexes.'
    public readonly name = 'init'
    public override readonly usesInitializationGuard = false

    public async handle(): Promise<void> {
        const context = await loadProjectContext()
        const alreadyInitialized =
            context.configExists &&
            (await readExtractionManifest(context.memoryDir))
        const progress = createInitProgressReporter()

        let grammars: string[] | undefined

        if (!alreadyInitialized) {
            this.print('')
            this.print('Initializing project memory')
            this.print('')

            await ensureKonteksGitignore(context.projectRoot)
            const files = await scanProjectFiles(context.projectRoot)
            const selection = await reviewDetectedGrammars(files)

            grammars = selection.selectedRegistryParserIds
        }

        const result = await initializeProjectMemory({
            context,
            grammars,
            onProgress: progress.report,
        }).finally(progress.done)

        if (result.alreadyInitialized) {
            this.print(
                `Project memory is already ready at ${result.memoryDir}.`,
            )
            return
        }

        progress.summary(result.extraction)
    }
}

type InitializeProjectMemoryResult =
    | {
          alreadyInitialized: true
          memoryDir: string
      }
    | {
          alreadyInitialized: false
          extraction: ExtractProjectResponse
          memoryDir: string
      }

async function initializeProjectMemory(options: {
    context: Project
    grammars?: string[]
    onProgress?: ExtractionProgressReporter
}): Promise<InitializeProjectMemoryResult> {
    const { context } = options
    if (
        context.configExists &&
        (await readExtractionManifest(context.memoryDir))
    ) {
        return {
            alreadyInitialized: true,
            memoryDir: context.memoryDir,
        }
    }

    await writeInitialMemoryFiles(context, options.grammars ?? [])
    await ensureProjectDatabase(await loadProjectContext())
    await ensureKonteksGitignore(context.projectRoot)

    const extractor = createProjectExtractor({
        onProgress: options.onProgress,
        prepareEmbeddingBeforeExtraction: true,
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
}

async function writeInitialMemoryFiles(
    context: Project,
    grammars: string[],
): Promise<void> {
    await mkdir(context.memoryDir, { recursive: true })
    await mkdir(join(context.memoryDir, 'objects'), { recursive: true })

    const defaultConfig = createDefaultConfig()
    await writeFile(
        context.configPath,
        `${JSON.stringify(
            {
                ...defaultConfig,
                extraction: {
                    grammars: {
                        ...defaultConfig.extraction.grammars,
                        selected: grammars,
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
