import {
    canPromptForGrammars,
    promptForGrammars,
} from '@/providers/cli/grammar-selection'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import {
    getGrammarDefinition,
    getGrammarForPath,
} from '@/providers/extraction/engine/grammar-loader'

export async function resolveInitialGrammars(
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
