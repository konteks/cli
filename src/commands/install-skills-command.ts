import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { resolveProjectContext } from '@/providers/project/context'
import { getPromptTemplates } from '@/providers/protocol/prompt-templates'

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

export type InstallKonteksSkillsRequest = {
    skillsDir: string
}

export type InstallKonteksSkillsResult = {
    installedCount: number
    skillsDir: string
}

async function installKonteksSkills(
    request: InstallKonteksSkillsRequest,
): Promise<InstallKonteksSkillsResult> {
    await mkdir(request.skillsDir, { recursive: true })

    const skills = getPromptTemplates().map(file =>
        promptFileToSkill(file.raw, file.fileName),
    )

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

function promptFileToSkill(
    source: string,
    fileName: string,
): { content: string; name: string } {
    const match =
        /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(source)
    if (!match?.groups) {
        throw new Error(`Prompt file is missing frontmatter: ${fileName}`)
    }

    const frontmatter = parseFrontmatter(match.groups.frontmatter)
    const name = requiredField(frontmatter, 'name', fileName)
    const title = requiredField(frontmatter, 'title', fileName)
    const description = requiredField(frontmatter, 'description', fileName)
    const body = match.groups.body
        .trim()
        .replaceAll('{{task}}', 'the task')
        .replaceAll(
            '{{topic}}',
            'any free-form text provided after `$konteks-warm-up`, if any',
        )
        .replaceAll(
            '{{prompt}}',
            'any free-form text provided after `$konteks-warm-up`, if any',
        )

    return {
        content: `---\nname: ${name}\ndescription: Use when working with Konteks MCP memory. ${description}\n---\n\n# ${title}\n\n${body}`,
        name,
    }
}

function parseFrontmatter(value: string): Record<string, string> {
    const fields: Record<string, string> = {}
    for (const line of value.split('\n')) {
        const separator = line.indexOf(':')
        if (separator === -1) {
            continue
        }
        fields[line.slice(0, separator).trim()] = line
            .slice(separator + 1)
            .trim()
    }
    return fields
}

function requiredField(
    frontmatter: Record<string, string>,
    key: string,
    fileName: string,
): string {
    const value = frontmatter[key]
    if (!value) {
        throw new Error(`Prompt file is missing "${key}": ${fileName}`)
    }
    return value
}
