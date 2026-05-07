import { describe, expect, it } from 'bun:test'
import {
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
    parseWarmUpInput,
    saveInputSchema,
} from './inputs.js'

describe('MCP input parsing', () => {
    it('accepts warm-up options', () => {
        expect(
            parseWarmUpInput({
                includeCommands: true,
                maxTokens: 2000,
            }),
        ).toEqual({
            includeCommands: true,
            includeOpenTasks: undefined,
            includeRecentSessions: undefined,
            maxTokens: 2000,
        })
    })

    it('requires recall task text', () => {
        expect(parseRecallInput({ task: 'continue auth refactor' }).task).toBe(
            'continue auth refactor',
        )
        expect(() => parseRecallInput({ task: '' })).toThrow('task is required')
    })

    it('requires search query text', () => {
        expect(parseSearchInput({ query: 'SQLite decision' }).query).toBe(
            'SQLite decision',
        )
        expect(() => parseSearchInput({ query: '' })).toThrow(
            'query is required',
        )
    })

    it('accepts structured memory save input', () => {
        expect(
            parseSaveInput({
                content:
                    'Use structured save payloads instead of raw chat transcripts.',
                importance: 5,
                kind: 'decision',
                tags: ['save'],
                type: 'memory',
            }),
        ).toEqual({
            content:
                'Use structured save payloads instead of raw chat transcripts.',
            importance: 5,
            kind: 'decision',
            source: undefined,
            tags: ['save'],
            type: 'memory',
        })
    })

    it('accepts structured memory batches and diary save input', () => {
        expect(
            parseSaveInput({
                memories: [
                    {
                        content: 'Konteks save must not pass raw full chat.',
                        kind: 'constraint',
                    },
                    {
                        content: 'Prefer one final diary per coherent session.',
                        kind: 'preference',
                    },
                ],
                type: 'memories',
            }),
        ).toEqual({
            memories: [
                {
                    content: 'Konteks save must not pass raw full chat.',
                    importance: undefined,
                    kind: 'constraint',
                    source: undefined,
                    tags: undefined,
                    type: 'memory',
                },
                {
                    content: 'Prefer one final diary per coherent session.',
                    importance: undefined,
                    kind: 'preference',
                    source: undefined,
                    tags: undefined,
                    type: 'memory',
                },
            ],
            type: 'memories',
        })

        expect(
            parseSaveInput({
                subject: 'structured save',
                summary:
                    'Implemented structured save payloads and updated prompts.',
                tags: ['save'],
                type: 'diary',
            }),
        ).toEqual({
            subject: 'structured save',
            summary:
                'Implemented structured save payloads and updated prompts.',
            tags: ['save'],
            type: 'diary',
        })
    })

    it('rejects raw chat transcript save input', () => {
        expect(() =>
            parseSaveInput({
                chat: 'User: save the whole transcript.',
            }),
        ).toThrow('type is required')
    })

    it('requires id or query for forget input', () => {
        expect(parseForgetInput({ query: 'Redux decision' }).query).toBe(
            'Redux decision',
        )
        expect(() => parseForgetInput({ mode: 'soft_delete' })).toThrow(
            'Either id or query is required.',
        )
    })

    it('exposes discoverable save schema for structured saves', () => {
        expect(JSON.stringify(saveInputSchema)).not.toContain('"chat"')
        expect(JSON.stringify(saveInputSchema)).toContain('"memories"')
        expect(JSON.stringify(saveInputSchema)).toContain('"constraint"')
        expect(JSON.stringify(saveInputSchema)).toContain('"diary"')
        expect(JSON.stringify(saveInputSchema)).not.toContain(
            'full session chat',
        )
    })
})
