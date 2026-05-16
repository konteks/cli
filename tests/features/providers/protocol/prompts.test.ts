import { describe, expect, it } from 'bun:test'
import { getKonteksPrompt, listKonteksPrompts } from '@/mcp/prompts'
import mcpTools from '@/mcp/tools'

function promptText(name: string, args: Record<string, string> = {}): string {
    const result = getKonteksPrompt(name, args)
    const content = result.messages[0]?.content
    return content?.type === 'text' ? content.text : ''
}

describe('MCP prompts', () => {
    it('does not expose a status tool', () => {
        expect(mcpTools.map(tool => tool.name)).not.toContain('konteks_status')
    })

    it('exposes tools in the documented MCP API order', () => {
        expect(mcpTools.map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save_memories',
            'konteks_save_diary',
            'konteks_search',
            'konteks_forget',
        ])
    })

    it('exposes lifecycle prompts with Konteks-prefixed names', () => {
        expect(listKonteksPrompts().map(prompt => prompt.name)).toEqual([
            'konteks-recall',
            'konteks-save',
            'konteks-warm-up',
        ])
        expect(listKonteksPrompts().map(prompt => prompt.title)).toEqual([
            'Konteks Recall',
            'Konteks Save',
            'Konteks Warm Up',
        ])
    })

    it('supports an optional warm-up focus prompt', () => {
        const warmUpPrompt = listKonteksPrompts().find(
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
        expect(unfocused).not.toContain('<prompt>')
        expect(focused).toContain('cli status command')
        expect(focused).toContain('konteks_warm_up')
        expect(focused).toContain(
            'Konteks is warmed up and ready for the task.',
        )
    })

    it('guides save toward diary plus durable memory without refresh noise', () => {
        const savePrompt = listKonteksPrompts().find(
            prompt => prompt.name === 'konteks-save',
        )
        const save = promptText('konteks-save')
        const warmUp = promptText('konteks-warm-up')

        expect(savePrompt?.arguments).toBeUndefined()
        expect(save).toContain(
            'Use the save tools only for these explicit user intents',
        )
        expect(save).toContain(
            'Do not call `konteks_save_memories` or `konteks_save_diary` automatically at the end of other workflows.',
        )
        expect(save).toContain('Lightweight remember')
        expect(save).toContain(
            'Save only durable memories with `konteks_save_memories`.',
        )
        expect(save).toContain('Do not write a diary for lightweight remember.')
        expect(save).toContain('After lightweight remember succeeds')
        expect(save).toContain('Do not pass the full raw chat transcript')
        expect(save).toContain(
            'For a full session save, call the save tools in two phases',
        )
        expect(save).toContain(
            'Save one compact session diary with `konteks_save_diary`',
        )
        expect(save).toContain('80-160 words or 3-6 short bullets')
        expect(save).toContain(
            'Each durable memory should be short but operational',
        )
        expect(save).toContain(
            'Do not turn completed implementation steps, file-by-file changelogs, test pass lists, or generic progress narration into durable memories',
        )
        expect(save).toContain('write a handoff summary, not a transcript')
        expect(save).toContain('Omit command logs, tool output, routine files')
        expect(save).toContain('konteks_save_memories')
        expect(save).toContain('Accepted durable memory batch shape')
        expect(save).toContain('konteks_save_diary')
        expect(save).toContain('If the memory payload is too large')
        expect(save).not.toContain('current Konteks task')
        expect(save).not.toContain('focus on')
        expect(`${save}\n${warmUp}`).not.toMatch(
            /\b(extract|index|refresh|repair|changed)\b/iu,
        )
    })
})
