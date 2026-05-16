import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { openConfigTui } from '@/providers/cli/grammar-selection'

export default class ConfigCommand extends BaseCommand {
    readonly description = 'Configure project-local Konteks settings.'
    readonly name = 'config'

    async handle({ globalOptions }: BaseCommandInput): Promise<void> {
        await openConfigTui(globalOptions.project)
    }
}
