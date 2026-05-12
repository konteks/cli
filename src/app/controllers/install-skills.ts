import {
    type InstallSkillOptions,
    installSkills,
} from '@/app/composition/skills'
import { terminal } from '@/app/support/terminal/service'

export async function installSkillsCommand(
    options: InstallSkillOptions,
): Promise<void> {
    const result = await installSkills(options)
    terminal.log(
        `Installed ${result.installedCount} Konteks skills at ${result.skillsDir}`,
    )
}
