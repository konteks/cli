import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import createProjectExtractor from '@/extraction/create-project-extractor'
import type { ExtractProjectResponse } from '@/models/extraction'
import {
    canPromptForGrammars,
    promptForGrammars,
} from '@/providers/cli/grammar-selection'
import createExtractionProgressReporter from '@/providers/extraction/create-extraction-progress-reporter'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import {
    getGrammarForPath,
    isBundledGrammar,
} from '@/providers/extraction/engine/grammar-loader'
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

    public async handle(_input: BaseCommandInput): Promise<void> {
        const context = await loadProjectContext()
        const alreadyInitialized =
            context.configExists &&
            (await readExtractionManifest(context.memoryDir))
        const grammars = alreadyInitialized
            ? undefined
            : await resolveInitialGrammars(context.projectRoot)
        const result = await initializeProject({ grammars })
        if (result.alreadyInitialized) {
            this.print(
                `Konteks is already initialized at ${result.memoryDir}. Use 'konteks repair' if memory artifacts need recovery.`,
            )
            return
        }

        this.print(`Initialized Konteks at ${result.memoryDir}`)
        this.print(
            `Extracted ${result.extraction.fileCount} files into ${result.extraction.chunkCount} sections`,
        )
    }
}

type InitializeProjectOptions = {
    grammars?: string[]
}

type InitializeProjectResult =
    | {
          alreadyInitialized: true
          memoryDir: string
      }
    | {
          alreadyInitialized: false
          extraction: ExtractProjectResponse
          memoryDir: string
      }

async function initializeProject(
    options: InitializeProjectOptions,
): Promise<InitializeProjectResult> {
    const context = await loadProjectContext()
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

    const defaultConfig = createDefaultConfig()
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
    await ensureProjectDatabase(await loadProjectContext())
    await ensureKonteksGitignore(context.projectRoot)

    const progress = createExtractionProgressReporter()
    try {
        const extractor = createProjectExtractor({
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

async function resolveInitialGrammars(projectRoot: string): Promise<string[]> {
    if (!canPromptForGrammars()) {
        return []
    }

    return await promptForGrammars(await detectProjectGrammars(projectRoot))
}

async function detectProjectGrammars(projectRoot: string): Promise<string[]> {
    const files = await scanProjectFiles(projectRoot)
    return [
        ...new Set(
            files.flatMap(file => {
                const grammar = getGrammarForPath(file.path)
                if (grammar && isBundledGrammar(grammar.id)) {
                    return []
                }
                return grammar ? [grammar.id] : []
            }),
        ),
    ]
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
