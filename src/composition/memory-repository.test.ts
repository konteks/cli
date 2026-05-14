import { describe, expect, it } from 'bun:test'
import { createMemoryRepository } from './memory-repository'

describe('composition/memory-repository', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['createMemoryRepository', createMemoryRepository, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['createMemoryRepository'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
