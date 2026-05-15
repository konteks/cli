import { describe, expect, it } from 'bun:test'
import ProjectStatusReader from './project-status-reader'

describe('providers/project/status-reader', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['ProjectStatusReader', ProjectStatusReader, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['ProjectStatusReader'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
