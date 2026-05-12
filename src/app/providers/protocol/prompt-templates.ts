import type { Prompt, PromptArgument } from '@modelcontextprotocol/sdk/types.js'
import recallMd from '@/app/assets/prompts/konteks-recall.md?raw'
import SaveMd from '@/app/assets/prompts/konteks-save.md?raw'
import warmUpMd from '@/app/assets/prompts/konteks-warm-up.md?raw'
import workOnExistingMd from '@/app/assets/prompts/konteks-work-on-existing.md?raw'
import workOnNewMd from '@/app/assets/prompts/konteks-work-on-new.md?raw'

export type PromptTemplate = {
    body: string
    fileName: string
    prompt: Prompt
    raw: string
}

type RawPrompt = {
    fileName: string
    raw: string
}

const rawPrompts: RawPrompt[] = [
    {
        fileName: 'konteks-recall.md',
        raw: recallMd,
    },
    {
        fileName: 'konteks-save.md',
        raw: SaveMd,
    },
    {
        fileName: 'konteks-warm-up.md',
        raw: warmUpMd,
    },
    {
        fileName: 'work-on-existing.md',
        raw: workOnExistingMd,
    },
    {
        fileName: 'work-on-new.md',
        raw: workOnNewMd,
    },
]

export function getPromptTemplates(): PromptTemplate[] {
    return rawPrompts.map(rawPrompt =>
        readPromptMarkdown(rawPrompt.raw, rawPrompt.fileName),
    )
}

function readPromptMarkdown(raw: string, fileName: string): PromptTemplate {
    const match =
        /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(raw)

    if (!match?.groups) {
        throw new Error(`Prompt file is missing frontmatter`)
    }

    const frontmatter = parseFrontmatter(match.groups.frontmatter)
    validateFontmatter(frontmatter)

    const prompt: Prompt = {
        description: frontmatter.description,
        name: frontmatter.name,
        title: frontmatter.title,
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

function validateFontmatter(frontmatter: Record<string, string>): void {
    const requiredFields = ['name', 'title', 'description']

    for (const field of requiredFields) {
        if (!frontmatter[field]) {
            throw new Error(`Prompt file is missing "${field}"`)
        }
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
