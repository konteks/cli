import type { Prompt } from '@modelcontextprotocol/sdk/types.js'
import { promptFiles } from './prompt-assets.js'

type PromptTemplate = {
    body: string
    fileName: string
    prompt: Prompt
    raw: string
}

const promptOrder = [
    'konteks-warm-up',
    'konteks-recall',
    'konteks-work-on-existing',
    'konteks-work-on-new',
    'konteks-save',
]

export function listPromptDefinitions(): Prompt[] {
    return promptTemplates().map(template => template.prompt)
}

export function listCanonicalPromptFiles(): Array<{
    content: string
    fileName: string
}> {
    return canonicalPromptTemplates().map(template => ({
        content: template.raw,
        fileName: template.fileName,
    }))
}

export function renderPromptText(
    name: string,
    args: Record<string, string>,
): string {
    const template = promptTemplates().find(item => item.prompt.name === name)
    if (!template) {
        return ''
    }

    return template.body.replaceAll(
        /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
        (_, key: string) => args[key]?.trim() || `<${key}>`,
    )
}

function promptTemplates(): PromptTemplate[] {
    return canonicalPromptTemplates()
}

function canonicalPromptTemplates(): PromptTemplate[] {
    return promptFiles
        .map(file => readPromptMarkdown(file.raw, file.fileName))
        .sort(
            (left, right) =>
                promptOrder.indexOf(left.prompt.name) -
                promptOrder.indexOf(right.prompt.name),
        )
}

function readPromptMarkdown(raw: string, fileName: string): PromptTemplate {
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
    const taskDescription = frontmatter['argument.task.description']
    if (taskDescription) {
        prompt.arguments = [
            {
                description: taskDescription,
                name: 'task',
                required: frontmatter['argument.task.required'] === 'true',
            },
        ]
    }

    return {
        body: match.groups.body.trim(),
        fileName,
        prompt,
        raw,
    }
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
