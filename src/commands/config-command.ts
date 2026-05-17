import BaseCommand from '@/commands/_base-command'
import { openConfigTui } from '@/providers/cli/grammar-selection'

export default class ConfigCommand extends BaseCommand {
    public readonly description = 'Configure project-local Konteks settings.'
    public readonly name = 'config'

    public async handle(): Promise<void> {
        await openConfigTui()
    }
}
