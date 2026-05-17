import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { getKonteksSkillFiles } from '@/mcp/prompts'
import { resolveProjectContext } from '@/providers/project/context'

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

        this.print(
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
    await mkdir(request.skillsDir, { recursive: true })

    const skills = getKonteksSkillFiles()

    for (const skill of skills) {
        const targetDir = join(request.skillsDir, skill.name)
        await mkdir(targetDir, { recursive: true })
        await writeFile(join(targetDir, 'SKILL.md'), `${skill.content}\n`)
    }

    return {
        installedCount: skills.length,
        skillsDir: request.skillsDir,
    }
}
