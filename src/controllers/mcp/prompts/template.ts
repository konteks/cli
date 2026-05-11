import type { Prompt, PromptArgument } from '@/services/mcp'

export type PromptTemplate = {
    body: string
    fileName: string
    prompt: Prompt
    raw: string
}

export function readPromptMarkdown(
    raw: string,
    fileName: string,
): PromptTemplate {
    const match =
        /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(raw)
    if (!match?.groups) {
        throw new Error(`Prompt file is missing frontmatter: ${fileName}`)
    }

    const frontmatter = parseFrontmatter(match.groups.frontmatter)
    const name = requiredField(frontmatter, 'name', fileName)
    const title = requiredField(frontmatter, 'title', fileName)
    const description = requiredField(frontmatter, 'description', fileName)
    const prompt: Prompt = {
        description,
        name,
        title,
    }
    const args = readPromptArguments(frontmatter)
    if (args.length > 0) {
        prompt.arguments = args
    }

    return {
        body: match.groups.body.trim(),
        fileName,
        prompt,
        raw,
    }
}

export function renderPromptTemplate(
    template: PromptTemplate,
    args: Record<string, string>,
): string {
    return template.body.replaceAll(
        /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
        (_, key: string) => renderArgumentValue(template.prompt, args, key),
    )
}

function readPromptArguments(
    frontmatter: Record<string, string>,
): PromptArgument[] {
    const names = new Set<string>()
    for (const key of Object.keys(frontmatter)) {
        const match = /^argument\.([a-zA-Z0-9_-]+)\.description$/u.exec(key)
        if (match?.[1]) {
            names.add(match[1])
        }
    }

    return [...names].sort().map(name => ({
        description: frontmatter[`argument.${name}.description`] ?? '',
        name,
        required: frontmatter[`argument.${name}.required`] === 'true',
    }))
}

function renderArgumentValue(
    prompt: Prompt,
    args: Record<string, string>,
    key: string,
): string {
    const value = args[key]?.trim()
    if (value) {
        return value
    }

    const argument = prompt.arguments?.find(item => item.name === key)
    return argument?.required === false ? '' : `<${key}>`
}

function parseFrontmatter(value: string): Record<string, string> {
    const fields: Record<string, string> = {}
    for (const line of value.split('\n')) {
        const separator = line.indexOf(':')
        if (separator === -1) {
            continue
        }
        const key = line.slice(0, separator).trim()
        const fieldValue = line.slice(separator + 1).trim()
        fields[key] = fieldValue
    }
    return fields
}

function requiredField(
    frontmatter: Record<string, string>,
    key: string,
    path: string,
): string {
    const value = frontmatter[key]
    if (!value) {
        throw new Error(`Prompt file is missing "${key}": ${path}`)
    }
    return value
}
