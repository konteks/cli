import { describe, expect, it } from 'bun:test'
import { createExtractionAction } from './extraction'

describe('composition/extraction', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['createExtractionAction', createExtractionAction, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['createExtractionAction'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
