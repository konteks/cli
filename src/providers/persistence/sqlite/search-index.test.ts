import { describe, expect, it } from 'bun:test'
import {
    ensureSearchIndex,
    hasSearchIndex,
    indexSearchDocument,
} from './search-index'

describe('providers/persistence/sqlite/search-index', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['ensureSearchIndex', ensureSearchIndex, 'function'],
            ['hasSearchIndex', hasSearchIndex, 'function'],
            ['indexSearchDocument', indexSearchDocument, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'ensureSearchIndex',
            'hasSearchIndex',
            'indexSearchDocument',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
