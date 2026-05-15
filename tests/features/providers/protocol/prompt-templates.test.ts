import { describe, expect, it } from 'bun:test'
import type { PromptTemplate } from '@/providers/protocol/prompt-templates'
import {
    getPromptTemplates,
    renderPromptTemplate,
} from '@/providers/protocol/prompt-templates'

describe('providers/protocol/prompt-templates', () => {
    it('loads all bundled prompt templates with MCP metadata', () => {
        const templates = getPromptTemplates()

        expect(templates.map(template => template.prompt.name).sort()).toEqual([
            'konteks-recall',
            'konteks-save',
            'konteks-warm-up',
        ])
        expect(
            templates.every(
                template =>
                    template.body.length > 0 &&
                    typeof template.prompt.description === 'string',
            ),
        ).toBe(true)
    })

    it('renders provided arguments and placeholders missing required values', () => {
        const template: PromptTemplate = {
            body: 'Task: {{ task }} Optional: {{ optional }}',
            fileName: 'test.md',
            prompt: {
                arguments: [
                    { name: 'task', required: true },
                    { name: 'optional', required: false },
                ],
                name: 'test',
            },
            raw: '',
        }

        expect(renderPromptTemplate(template, { task: 'ship tests' })).toBe(
            'Task: ship tests Optional: ',
        )
        expect(renderPromptTemplate(template, {})).toBe(
            'Task: <task> Optional: ',
        )
    })
})
