import { describe, expect, it } from 'bun:test'
import type { KonteksPromptRegistration } from './prompts'
import {
    getKonteksPrompt,
    getKonteksPromptRegistrations,
    listKonteksPrompts,
} from './prompts'

type CoveredTypes = [KonteksPromptRegistration]

describe('mcp/prompts', () => {
    it('lists lifecycle prompts in API order', () => {
        expect(listKonteksPrompts().map(prompt => prompt.name)).toEqual([
            'konteks-recall',
            'konteks-save',
            'konteks-warm-up',
        ])
    })

    it('renders prompt text messages with supplied arguments', () => {
        const result = getKonteksPrompt('konteks-warm-up', {
            topic: 'cli status command',
        })

        expect(result.messages).toEqual([
            {
                content: {
                    text: expect.stringContaining('cli status command'),
                    type: 'text',
                },
                role: 'user',
            },
        ])
        expect(result.messages[0]?.content.text).toContain('konteks_warm_up')
    })

    it('throws for unknown prompts', () => {
        expect(() => getKonteksPrompt('not-real')).toThrow(
            'Unknown Konteks prompt: not-real',
        )
    })

    it('creates server prompt registrations', () => {
        const warmUp = getKonteksPromptRegistrations().find(
            prompt => prompt.name === 'konteks-warm-up',
        )

        expect(warmUp?.args).toEqual([
            {
                description:
                    'Optional free-form topic, module, file, behavior, decision, or memory focus for targeted recall after warm up.',
                name: 'topic',
                required: false,
            },
        ])
        expect(
            warmUp?.render({ topic: 'runtime' }).messages[0]?.content.text,
        ).toContain('runtime')
    })

    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        expect(['KonteksPromptRegistration']).toEqual([
            'KonteksPromptRegistration',
        ])
    })
})
