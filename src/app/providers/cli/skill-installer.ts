import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPromptTemplates } from '@/app/providers/protocol/prompt-templates'

export type InstallKonteksSkillsRequest = {
    skillsDir: string
}

export type InstallKonteksSkillsResult = {
    installedCount: number
    skillsDir: string
}

export async function installKonteksSkills(
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
