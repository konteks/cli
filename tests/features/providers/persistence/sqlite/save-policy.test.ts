import { describe, expect, it } from 'bun:test'
import {
    importanceToConfidence,
    isSkippableMemoryError,
    summarizeText,
    validateMemoryQuality,
    validateSessionQuality,
    withProjectUpdateSummary,
} from '@/database/support/save-policy'

describe('providers/persistence/sqlite/save-policy', () => {
    it('normalizes summaries and truncates long content', () => {
        expect(summarizeText('  one\n\n two   three  ')).toBe('one two three')
        expect(summarizeText(`${'word '.repeat(80)}`).endsWith('...')).toBe(
            true,
        )
    })

    it.each([
        [undefined, 1],
        [1, 0.2],
        [3, 0.6],
        [5, 1],
    ])('maps importance %p to confidence %p', (importance, expected) => {
        expect(importanceToConfidence(importance)).toBe(expected)
    })

    it('validates memory and diary quality', () => {
        expect(() =>
            validateMemoryQuality('This memory has enough useful words.'),
        ).not.toThrow()
        expect(() => validateMemoryQuality('too short')).toThrow('too short')
        expect(() =>
            validateMemoryQuality('api_key = abcdefghijklmnopqrstuvwxyz'),
        ).toThrow('secret')
        expect(() => validateSessionQuality('short')).toThrow('too short')
    })

    it('appends project update summaries to diary saves', () => {
        expect(
            withProjectUpdateSummary(
                { summary: 'Session summary has enough words.' },
                {
                    deletedFilePaths: ['src/old.ts'],
                    updatedFilePaths: ['src/new.ts'],
                },
            ).summary,
        ).toContain('Updated project files considered: src/new.ts')
    })

    it('classifies only low-quality memory errors as skippable', () => {
        expect(isSkippableMemoryError(new Error('memory is too short'))).toBe(
            true,
        )
        expect(isSkippableMemoryError(new Error('contains secret'))).toBe(true)
        expect(isSkippableMemoryError(new Error('database unavailable'))).toBe(
            false,
        )
    })
})
