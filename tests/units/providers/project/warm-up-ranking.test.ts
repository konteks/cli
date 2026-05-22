import { describe, expect, it } from 'bun:test'
import type { WarmUpObservationRow } from '@/providers/project/warm-up-ranking'
import {
    guidanceFromObservations,
    recencyBoost,
    roleImportance,
    targetImportance,
} from '@/providers/project/warm-up-ranking'

describe('providers/project/warm-up-ranking', () => {
    it.each([
        ['module' as const, 80],
        ['section' as const, 60],
        ['memory' as const, 40],
    ])('scores target type %p as %p', (type, expected) => {
        expect(targetImportance(type)).toBe(expected)
    })

    it.each([
        ['app_code', 35],
        ['package_config', 30],
        ['test_code', 25],
        ['product_doc', 15],
        ['other', 5],
        [null, 5],
    ])('scores role %p as %p', (role, expected) => {
        expect(roleImportance(role)).toBe(expected)
    })

    it('returns zero recency boost for invalid dates and positive boost for current dates', () => {
        expect(recencyBoost('not a date')).toBe(0)
        expect(recencyBoost(new Date().toISOString())).toBeGreaterThan(0)
    })

    it('ranks durable guidance and filters implementation logs', () => {
        const rows: WarmUpObservationRow[] = [
            {
                id: 'skip',
                kind: 'decision',
                text_inline: 'Added regression test for a previous issue.',
            },
            {
                id: 'constraint',
                kind: 'constraint',
                text_inline: 'Memory save must avoid raw chat transcripts.',
            },
            {
                id: 'preference',
                kind: 'preference',
                text_inline: 'Prefer concise CLI output.',
            },
        ]

        expect(guidanceFromObservations(rows)).toEqual([
            {
                id: 'constraint',
                kind: 'constraint',
                text: 'Memory save must avoid raw chat transcripts.',
            },
            {
                id: 'preference',
                kind: 'convention',
                text: 'Prefer concise CLI output.',
            },
        ])
    })
})
