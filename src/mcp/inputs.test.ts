import { describe, expect, it } from 'bun:test'
import {
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
    parseWarmUpInput,
    saveInputSchema,
    warmUpInputSchema,
} from './inputs.js'

describe('MCP input parsing', () => {
    it('accepts warm-up options', () => {
        expect(
            parseWarmUpInput({
                maxTokens: 2000,
                topic: 'recall output',
            }),
        ).toEqual({
            maxTokens: 2000,
            topic: 'recall output',
        })
    })

    it('keeps warm-up schema limited to implemented options', () => {
        expect(Object.keys(warmUpInputSchema.shape)).toEqual([
            'maxTokens',
            'topic',
        ])
    })

    it('requires recall task text', () => {
        expect(parseRecallInput({ task: 'continue auth refactor' }).task).toBe(
            'continue auth refactor',
        )
        expect(() => parseRecallInput({ task: '' })).toThrow()
    })

    it('requires search query text', () => {
        expect(parseSearchInput({ query: 'SQLite decision' }).query).toBe(
            'SQLite decision',
        )
        expect(() => parseSearchInput({ query: '' })).toThrow()
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
                        type: 'memory',
                    },
                    {
                        content: 'Prefer one final diary per coherent session.',
                        kind: 'preference',
                        type: 'memory',
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
        ).toThrow()
    })

    it('requires id or query for forget input', () => {
        expect(parseForgetInput({ query: 'Redux decision' }).query).toBe(
            'Redux decision',
        )
        expect(() => parseForgetInput({ mode: 'soft_delete' })).toThrow()
    })

    it('exposes discoverable save schema for structured saves', () => {
        expect(saveInputSchema).toBeDefined()
    })
})
