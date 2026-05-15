import { describe, expect, it } from 'bun:test'
import SAVE_INPUT_SCHEMA from './save-input-schema'

describe('SAVE_INPUT_SCHEMA', () => {
    it('accepts one durable memory', () => {
        expect(
            SAVE_INPUT_SCHEMA.parse({
                content: 'Use class based MCP tools.',
                kind: 'decision',
                type: 'memory',
            }),
        ).toEqual({
            content: 'Use class based MCP tools.',
            kind: 'decision',
            type: 'memory',
        })
    })

    it('defaults item type inside memory batches', () => {
        expect(
            SAVE_INPUT_SCHEMA.parse({
                memories: [
                    {
                        content: 'Keep MCP tool schemas near tools.',
                        kind: 'preference',
                    },
                ],
                type: 'memories',
            }),
        ).toEqual({
            memories: [
                {
                    content: 'Keep MCP tool schemas near tools.',
                    kind: 'preference',
                    type: 'memory',
                },
            ],
            type: 'memories',
        })
    })

    it('accepts a diary summary', () => {
        expect(
            SAVE_INPUT_SCHEMA.parse({
                summary: 'Finished MCP tool refactor with colocated tests.',
                type: 'diary',
            }),
        ).toEqual({
            summary: 'Finished MCP tool refactor with colocated tests.',
            type: 'diary',
        })
    })

    it('rejects short or sensitive save text', () => {
        expect(() =>
            SAVE_INPUT_SCHEMA.parse({
                summary: 'too short',
                type: 'diary',
            }),
        ).toThrow('content is too short to save')

        expect(() =>
            SAVE_INPUT_SCHEMA.parse({
                summary: 'api_key = abcdefghijklmnopqrstuvwxyz',
                type: 'diary',
            }),
        ).toThrow('content appears to contain a secret')
    })
})
