import { describe, expect, it } from 'bun:test'
import {
    parseBootstrapInput,
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
} from './inputs.js'

describe('MCP input parsing', () => {
    it('accepts bootstrap options', () => {
        expect(
            parseBootstrapInput({
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

    it('accepts session handoff save input', () => {
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
})
