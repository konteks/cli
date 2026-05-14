import { describe, expect, it } from 'bun:test'
import { RecallMemoryAction } from './recall-memory-action'

describe('actions/recall-memory-action', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['RecallMemoryAction', RecallMemoryAction, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['RecallMemoryAction'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
