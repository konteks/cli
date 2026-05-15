import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { openConfigTui } from '@/providers/cli/grammar-selection'

export default class ConfigCommand extends BaseCommand {
    constructor() {
        super({
            description: 'Configure project-local Konteks settings.',
            name: 'config',
            printsHeader: true,
        })
    }

    override async handle({ globalOptions }: BaseCommandInput): Promise<void> {
        await openConfigTui(globalOptions.project)
    }
}
