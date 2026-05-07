import { describe, expect, it } from 'bun:test'
import { getMcpPrompt, listMcpPrompts, listMcpTools } from './server.js'

function promptText(name: string, args: Record<string, string> = {}): string {
    const result = getMcpPrompt(name, args)
    const content = result.messages[0]?.content
    return content?.type === 'text' ? content.text : ''
}

describe('MCP prompts', () => {
    it('does not expose a status tool', () => {
        expect(listMcpTools({}).map(tool => tool.name)).not.toContain(
            'konteks_status',
        )
    })

    it('exposes lifecycle prompts with Konteks-prefixed names', () => {
        expect(listMcpPrompts().map(prompt => prompt.name)).toEqual([
            'konteks-warm-up',
            'konteks-recall',
            'konteks-work-on-existing',
            'konteks-work-on-new',
            'konteks-save',
        ])
        expect(listMcpPrompts().map(prompt => prompt.title)).toEqual([
            'Konteks Warm Up',
            'Konteks Recall',
            'Konteks Build Existing',
            'Konteks Build New',
            'Konteks Save',
        ])
    })

    it('keeps recall supplemental during build prompts', () => {
        const existing = promptText('konteks-work-on-existing', {
            task: 'refactor auth session refresh',
        })
        const next = promptText('konteks-work-on-new', {
            task: 'add notification center',
        })

        expect(existing).toContain('If known modules')
        expect(existing).toContain('call `konteks_recall` first')
        expect(next).toContain('Call `konteks_recall` only if')
    })

    it('guides save toward diary plus durable memory without refresh noise', () => {
        const savePrompt = listMcpPrompts().find(
            prompt => prompt.name === 'konteks-save',
        )
        const save = promptText('konteks-save')
        const warmUp = promptText('konteks-warm-up')

        expect(savePrompt?.arguments).toBeUndefined()
        expect(save).toContain('`chat` argument')
        expect(save).toContain('Call `konteks_save` once')
        expect(save).toContain('Do not call `konteks_save` repeatedly')
        expect(save).toContain('make them searchable')
        expect(save).toContain('write one diary entry')
        expect(save).not.toContain('current Konteks task')
        expect(save).not.toContain('focus on')
        expect(`${save}\n${warmUp}`).not.toMatch(
            /\b(extract|index|refresh|mine|repair|changed)\b/iu,
        )
    })
})
