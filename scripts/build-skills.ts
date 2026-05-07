import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const promptDir = join(process.cwd(), 'src', 'mcp', 'prompts')
const outputDir = join(process.cwd(), 'dist', 'skills')

await rm(outputDir, { force: true, recursive: true })
await mkdir(outputDir, { recursive: true })

const promptFiles = (await readdir(promptDir))
    .filter(file => file.endsWith('.md'))
    .sort()

for (const fileName of promptFiles) {
    const source = await readFile(join(promptDir, fileName), 'utf8')
    const skill = promptToSkill(source, fileName)
    const skillDir = join(outputDir, skill.name)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), `${skill.content}\n`)
}

function promptToSkill(
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
    const body = match.groups.body.trim().replaceAll('{{task}}', 'the task')

    return {
        content: `---\nname: ${name}\ndescription: ${skillDescription(description)}\n---\n\n# ${title}\n\n${body}`,
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

function skillDescription(description: string): string {
    return `Use when working with Konteks MCP memory. ${description}`
}
