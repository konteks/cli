import { homedir } from 'node:os'
import { join } from 'node:path'
import installKonteksSkills, {
    type InstallKonteksSkillsResult,
} from '@/providers/cli/install-konteks-skills'
import { resolveProjectContext } from '@/providers/project/context'

export type InstallSkillOptions = {
    global?: boolean
    homeDir?: string
    project?: string
}

export default async function installSkills(
    options: InstallSkillOptions,
): Promise<InstallKonteksSkillsResult> {
    const skillsDir = options.global
        ? join(options.homeDir ?? homedir(), '.agents', 'skills')
        : join(
              (await resolveProjectContext(options.project)).projectRoot,
              '.agents',
              'skills',
          )

    return await installKonteksSkills({ skillsDir })
}
