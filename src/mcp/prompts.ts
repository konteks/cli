import type { Prompt } from '@modelcontextprotocol/sdk/types.js'
import {
    getPromptTemplates,
    renderPromptTemplate,
} from '@/providers/protocol/prompt-templates'

export type KonteksPromptRegistration = {
    args: NonNullable<Prompt['arguments']>
    description?: string
    name: string
    render(args: Record<string, string>): {
        messages: Array<{
            content: { text: string; type: 'text' }
            role: 'user'
        }>
    }
}

type KonteksPromptTemplate = ReturnType<typeof getPromptTemplates>[number]

export function listKonteksPrompts(): Prompt[] {
    return getPromptTemplates().map(template => template.prompt)
}

export function getKonteksPrompt(
    name: string,
    args: Record<string, string> = {},
): {
    description?: string
    messages: Array<{ content: { text: string; type: 'text' }; role: 'user' }>
} {
    const template = promptTemplateByName(name)

    return {
        description: template.prompt.description,
        messages: [
            {
                content: {
                    text: renderPromptTemplate(template, args),
                    type: 'text',
                },
                role: 'user',
            },
        ],
    }
}

export function getKonteksPromptRegistrations(): KonteksPromptRegistration[] {
    return getPromptTemplates().map(template => ({
        args: template.prompt.arguments ?? [],
        description: template.prompt.description,
        name: template.prompt.name,
        render: (args: Record<string, string>) => ({
            messages: [
                {
                    content: {
                        text: renderPromptTemplate(template, args),
                        type: 'text',
                    },
                    role: 'user',
                },
            ],
        }),
    }))
}

function promptTemplateByName(name: string): KonteksPromptTemplate {
    const template = getPromptTemplates().find(
        item => item.prompt.name === name,
    )
    if (!template) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }
    return template
}
