import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import installSkills, {
    type InstallSkillOptions,
} from '@/composition/install-skills'

export default class InstallSkillsCommand extends BaseCommand<
    [],
    { global?: boolean }
> {
    constructor() {
        super({
            description:
                'Install Konteks skills for agents without MCP prompts.',
            name: 'install-skills',
            printsHeader: true,
        })
    }

    protected override configure(command: Command): void {
        command.option('--global', 'Install into ~/.agents/skills')
    }

    override async handle({
        globalOptions,
        options,
    }: BaseCommandInput<[], { global?: boolean }>): Promise<void> {
        await this.run({ ...globalOptions, ...options })
    }

    async run(options: InstallSkillOptions): Promise<void> {
        const result = await installSkills(options)
        this.print(
            `Installed ${result.installedCount} Konteks skills at ${result.skillsDir}`,
        )
    }
}
