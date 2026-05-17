import { checkbox } from '@inquirer/prompts'
import { listGrammarDefinitions } from '@/providers/extraction/engine/grammar-loader'
import { terminal } from '@/support/terminal/service'

export async function promptForGrammars(selected: string[]): Promise<string[]> {
    if (!canPromptForGrammars()) {
        return selected
    }

    return checkbox({
        choices: listGrammarDefinitions()
            .sort((left, right) =>
                left.displayName.localeCompare(right.displayName),
            )
            .map(grammar => ({
                checked: selected.includes(grammar.id),
                name: ` ${grammar.displayName} (${grammar.extensions.join(', ')})`,
                value: grammar.id,
            })),
        loop: true,
        message:
            'Select the programming languages or file types used in this project',
    })
}

export function canPromptForGrammars(): boolean {
    return terminal.stdinIsInteractive() && terminal.stderrIsInteractive()
}
