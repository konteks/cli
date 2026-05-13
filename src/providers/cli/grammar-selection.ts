import { checkbox, select } from '@inquirer/prompts'
import {
    listGrammarDefinitions,
    updateSelectedGrammarCache,
} from '@/providers/extraction/engine/grammar-loader'
import { createMineProgressReporter } from '@/providers/extraction/progress-reporter'
import {
    loadProjectContext,
    writeProjectConfig,
} from '@/providers/project/context'
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
        message: 'Select Tree-sitter grammars to use for this project',
    })
}

export function canPromptForGrammars(): boolean {
    return terminal.stdinIsInteractive() && terminal.stderrIsInteractive()
}

export async function openConfigTui(project?: string): Promise<void> {
    const context = await loadProjectContext(project)
    const section = await select({
        choices: [
            { name: 'Grammars', value: 'grammars' },
            { name: 'Check for update', value: 'updates' },
        ],
        loop: false,
        message: 'Configure Konteks',
    })

    if (section === 'grammars') {
        const selected = await promptForGrammars(
            context.config.extraction.grammars.selected,
        )
        await writeProjectConfig(context, {
            ...context.config,
            extraction: {
                ...context.config.extraction,
                grammars: {
                    ...context.config.extraction.grammars,
                    selected,
                },
            },
        })
        terminal.log(`Saved ${selected.length} selected grammars.`)
        return
    }

    const progress = createMineProgressReporter()
    try {
        const result = await updateSelectedGrammarCache(context, {
            onProgress: progress.report,
        })
        terminal.log(
            `Grammar cache checked: ${result.updated} updated, ${result.reused} unchanged.`,
        )
    } finally {
        progress.done()
    }
}
