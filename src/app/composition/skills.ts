import { homedir } from 'node:os'
import { join } from 'node:path'
import {
    type InstallKonteksSkillsResult,
    installKonteksSkills,
} from '@/app/providers/cli/skill-installer'
import { resolveProjectContext } from '@/app/providers/project/context'

export type InstallSkillOptions = {
    global?: boolean
    homeDir?: string
    project?: string
}

export async function installSkills(
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
