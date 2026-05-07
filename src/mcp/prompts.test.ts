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

    it('supports an optional warm-up focus topic', () => {
        const warmUpPrompt = listMcpPrompts().find(
            prompt => prompt.name === 'konteks-warm-up',
        )
        const unfocused = promptText('konteks-warm-up')
        const focused = promptText('konteks-warm-up', {
            topic: 'cli status command',
        })

        expect(warmUpPrompt?.arguments).toEqual([
            {
                description:
                    'Optional free-form topic, module, file, behavior, decision, or memory focus for targeted recall after warm up.',
                name: 'topic',
                required: false,
            },
        ])
        expect(unfocused).toContain('Optional free-form focus: \n')
        expect(unfocused).not.toContain('<topic>')
        expect(focused).toContain(
            'Optional free-form focus: cli status command',
        )
        expect(focused).toContain('also call `konteks_recall`')
        expect(focused).toContain(
            'Konteks is warmed up and ready for the task.',
        )
    })

    it('guides save toward diary plus durable memory without refresh noise', () => {
        const savePrompt = listMcpPrompts().find(
            prompt => prompt.name === 'konteks-save',
        )
        const save = promptText('konteks-save')
        const warmUp = promptText('konteks-warm-up')

        expect(savePrompt?.arguments).toBeUndefined()
        expect(save).toContain('Do not pass the full raw chat transcript')
        expect(save).toContain('Call `konteks_save` in two phases')
        expect(save).toContain('type: "memories"')
        expect(save).toContain('type: "diary"')
        expect(save).toContain('If the memory payload is too large')
        expect(save).not.toContain('current Konteks task')
        expect(save).not.toContain('focus on')
        expect(`${save}\n${warmUp}`).not.toMatch(
            /\b(extract|index|refresh|mine|repair|changed)\b/iu,
        )
    })
})
