import { describe, expect, it } from 'bun:test'
import { parsePromptArguments } from './mcp-prompt-input'

describe('support/cli/mcp-prompt-input', () => {
    it('returns empty arguments for blank input', () => {
        expect(parsePromptArguments('konteks-recall')).toEqual({})
        expect(parsePromptArguments('konteks-recall', '   ')).toEqual({})
    })

    it('maps free-form warm-up input to a topic', () => {
        expect(
            parsePromptArguments('konteks-warm-up', 'test coverage'),
        ).toEqual({
            topic: 'test coverage',
        })
    })

    it('parses JSON object arguments and rejects invalid shapes', () => {
        expect(
            parsePromptArguments('konteks-recall', '{"task":"continue tests"}'),
        ).toEqual({ task: 'continue tests' })
        expect(() => parsePromptArguments('konteks-recall', '[]')).toThrow(
            'Prompt arguments must be a JSON object.',
        )
        expect(() =>
            parsePromptArguments('konteks-recall', '{"task":123}'),
        ).toThrow('Prompt argument "task" must be a string.')
    })
})
