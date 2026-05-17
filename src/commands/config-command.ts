import { select } from '@inquirer/prompts'
import BaseCommand from '@/commands/_base-command'
import { promptForGrammars } from '@/providers/cli/grammar-selection'
import createExtractionProgressReporter from '@/providers/extraction/create-extraction-progress-reporter'
import { updateSelectedGrammarCache } from '@/providers/extraction/engine/grammar-loader'
import {
    loadProjectContext,
    writeProjectConfig,
} from '@/providers/project/context'

export default class ConfigCommand extends BaseCommand {
    public readonly description = 'Configure project-local Konteks settings.'
    public readonly name = 'config'

    public async handle(): Promise<void> {
        const context = await loadProjectContext()
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
            this.print(`Saved ${selected.length} selected grammars.`)
            return
        }

        const progress = createExtractionProgressReporter()
        try {
            const result = await updateSelectedGrammarCache(context, {
                onProgress: progress.report,
            })
            this.print(
                `Grammar cache checked: ${result.updated} updated, ${result.reused} unchanged.`,
            )
        } finally {
            progress.done()
        }
    }
}
