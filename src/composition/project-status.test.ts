import { describe, expect, it } from 'bun:test'
import { readProjectStatus } from './project-status'

describe('composition/project-status', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['readProjectStatus', readProjectStatus, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['readProjectStatus'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
