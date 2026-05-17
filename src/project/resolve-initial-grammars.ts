import {
    canPromptForGrammars,
    promptForGrammars,
} from '@/providers/cli/grammar-selection'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import { getGrammarForPath } from '@/providers/extraction/engine/grammar-loader'

export default async function resolveInitialGrammars(
    projectRoot: string,
): Promise<string[]> {
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
                return grammar ? [grammar.id] : []
            }),
        ),
    ]
}
