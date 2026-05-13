import { initializeProject } from '@/composition/project-initialization'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { GlobalCliOptions } from '@/models/cli'
import {
    canPromptForGrammars,
    promptForGrammars,
} from '@/providers/cli/grammar-selection'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import {
    getGrammarDefinition,
    getGrammarForPath,
} from '@/providers/extraction/engine/grammar-loader'
import { readMineManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'
import { terminal } from '@/support/terminal/service'

type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProviderContract
    grammar?: string[]
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
    const context = await loadProjectContext(options.project)
    const alreadyInitialized =
        context.configExists && (await readMineManifest(context.memoryDir))
    const grammars = alreadyInitialized
        ? undefined
        : await resolveInitialGrammars(context.projectRoot, options.grammar)
    const result = await initializeProject({ ...options, grammars })
    if (result.alreadyInitialized) {
        terminal.log(
            `Konteks is already initialized at ${result.memoryDir}. Use 'konteks repair' if memory artifacts need recovery.`,
        )
        return
    }

    terminal.log(`Initialized Konteks at ${result.memoryDir}`)
    terminal.log(
        `Extracted ${result.extraction.fileCount} files into ${result.extraction.chunkCount} sections`,
    )
}

async function resolveInitialGrammars(
    projectRoot: string,
    values?: string[],
): Promise<string[]> {
    if (values) {
        return validateGrammarIds(values)
    }

    if (!canPromptForGrammars()) {
        return []
    }

    return await promptForGrammars(await detectProjectGrammars(projectRoot))
}

function validateGrammarIds(values: string[]): string[] {
    const invalid = values.filter(value => !getGrammarDefinition(value))
    if (invalid.length > 0) {
        throw new Error(`Unknown grammar id: ${invalid.join(', ')}`)
    }

    return [...new Set(values)]
}

async function detectProjectGrammars(projectRoot: string): Promise<string[]> {
    const files = await scanProjectFiles(projectRoot)
    return [
        ...new Set(
            files.flatMap(file => {
                const grammar = getGrammarForPath(file.path)
                return grammar ? [grammar.id] : []
            }),
        ),
    ]
}
