import installSkills, {
    type InstallSkillOptions,
} from '@/composition/install-skills'
import { terminal } from '@/support/terminal/service'

export default async function installSkillsCommand(
    options: InstallSkillOptions,
): Promise<void> {
    const result = await installSkills(options)
    terminal.log(
        `Installed ${result.installedCount} Konteks skills at ${result.skillsDir}`,
    )
}
