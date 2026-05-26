import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getKonteksSkillFiles } from '@/entrypoints/mcp/prompts'
import { resolveProjectContext } from '@/modules/project/context'
import { mkdir } from '@/support/file-manager'
import type { BaseCommandInput } from './_base-command'
import BaseCommand from './_base-command'
export default class InstallSkillsCommand extends BaseCommand<
    [],
    { global?: boolean }
> {
    public readonly description =
        'Install Konteks skills for agents without MCP prompts.'
    public readonly name = 'install-skills'
    public override readonly options = [
        {
            description: 'Install into ~/.agents/skills',
            flags: '--global',
        },
    ]

    public async handle(
        { options }: BaseCommandInput<[], { global?: boolean }> | undefined = {
            options: {},
        },
    ): Promise<void> {
        const skillsDir = options?.global
            ? join(homedir(), '.agents', 'skills')
            : join(
                  (await resolveProjectContext()).projectRoot,
                  '.agents',
                  'skills',
              )

        const result = await installKonteksSkills({ skillsDir })

        this.consoleOutput.print(
            `Installed ${result.installedCount} Konteks skills at ${result.skillsDir}`,
        )
    }
}

type InstallKonteksSkillsRequest = {
    skillsDir: string
}

type InstallKonteksSkillsResult = {
    installedCount: number
    skillsDir: string
}

async function installKonteksSkills(
    request: InstallKonteksSkillsRequest,
): Promise<InstallKonteksSkillsResult> {
    await mkdir(request.skillsDir)

    const skills = getKonteksSkillFiles()

    for (const skill of skills) {
        const targetDir = join(request.skillsDir, skill.name)
        await mkdir(targetDir)
        await writeFile(join(targetDir, 'SKILL.md'), `${skill.content}\n`)
    }

    return {
        installedCount: skills.length,
        skillsDir: request.skillsDir,
    }
}
