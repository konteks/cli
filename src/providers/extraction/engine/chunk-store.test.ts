import { describe, expect, it } from 'bun:test'
import { extractChunks } from './chunk-store'

describe('providers/extraction/engine/chunk-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['extractChunks', extractChunks, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['extractChunks'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
