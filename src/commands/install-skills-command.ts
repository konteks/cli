import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import installSkills, {
    type InstallSkillOptions,
} from '@/composition/install-skills'

export default class InstallSkillsCommand extends BaseCommand<
    [],
    { global?: boolean }
> {
    readonly description =
        'Install Konteks skills for agents without MCP prompts.'
    readonly name = 'install-skills'
    override readonly options = [
        {
            description: 'Install into ~/.agents/skills',
            flags: '--global',
        },
    ]

    async handle({
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
