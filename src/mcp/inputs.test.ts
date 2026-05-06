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

    it('accepts durable memory save input', () => {
        expect(
            parseSaveInput({
                content: 'Use WASM SQLite by default.',
                kind: 'decision',
                type: 'memory',
            }),
        ).toEqual({
            content: 'Use WASM SQLite by default.',
            entities: undefined,
            importance: undefined,
            kind: 'decision',
            source: undefined,
            tags: undefined,
            type: 'memory',
        })
    })

    it('accepts diary save input', () => {
        expect(
            parseSaveInput({
                subject: 'MCP prompt rollout',
                summary: 'Renamed prompts to konteks-* and verified listing.',
                tags: ['mcp', 'prompts'],
                type: 'diary',
            }),
        ).toEqual({
            subject: 'MCP prompt rollout',
            summary: 'Renamed prompts to konteks-* and verified listing.',
            tags: ['mcp', 'prompts'],
            type: 'diary',
        })
    })

    it('accepts legacy session handoff save input', () => {
        expect(
            parseSaveInput({
                status: 'partial',
                summary: 'Scaffolded the MCP server.',
                task: 'implement MVP spine',
                type: 'session',
            }),
        ).toEqual({
            blockers: undefined,
            decisions: undefined,
            entities: undefined,
            filesTouched: undefined,
            nextSteps: undefined,
            openQuestions: undefined,
            status: 'partial',
            summary: 'Scaffolded the MCP server.',
            task: 'implement MVP spine',
            testsRun: undefined,
            type: 'session',
        })
    })

    it('requires id or query for forget input', () => {
        expect(parseForgetInput({ query: 'Redux decision' }).query).toBe(
            'Redux decision',
        )
        expect(() => parseForgetInput({ mode: 'soft_delete' })).toThrow(
            'Either id or query is required.',
        )
    })

    it('exposes discoverable save schema branches for memory and diary', () => {
        const branches =
            (saveInputSchema as { oneOf?: readonly unknown[] }).oneOf ?? []
        const memoryBranch = branches.find(
            item =>
                typeof item === 'object' &&
                item !== null &&
                JSON.stringify(item).includes('"const":"memory"'),
        )
        const diaryBranch = branches.find(
            item =>
                typeof item === 'object' &&
                item !== null &&
                JSON.stringify(item).includes('"const":"diary"'),
        )

        expect(memoryBranch).toBeDefined()
        expect(diaryBranch).toBeDefined()
    })
})
