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

    it('accepts chat transcript save input', () => {
        expect(
            parseSaveInput({
                chat: 'User: We should save the whole session chat.\nAssistant: I implemented chat extraction.',
            }),
        ).toEqual({
            chat: 'User: We should save the whole session chat.\nAssistant: I implemented chat extraction.',
            type: 'chat',
        })
    })

    it('rejects repeated manual save shapes at the MCP boundary', () => {
        expect(() =>
            parseSaveInput({
                content: 'Use WASM SQLite by default.',
                kind: 'decision',
                type: 'memory',
            }),
        ).toThrow('chat is required')
        expect(() =>
            parseSaveInput({
                summary: 'Renamed prompts to konteks-* and verified listing.',
                type: 'diary',
            }),
        ).toThrow('chat is required')
    })

    it('requires id or query for forget input', () => {
        expect(parseForgetInput({ query: 'Redux decision' }).query).toBe(
            'Redux decision',
        )
        expect(() => parseForgetInput({ mode: 'soft_delete' })).toThrow(
            'Either id or query is required.',
        )
    })

    it('exposes discoverable save schema for full chat ingestion', () => {
        expect(JSON.stringify(saveInputSchema)).toContain('"chat"')
        expect(JSON.stringify(saveInputSchema)).not.toContain('"memory"')
        expect(JSON.stringify(saveInputSchema)).not.toContain('"diary"')
    })
})
