import { describe, expect, it } from 'bun:test'
import getToolDetailCommand from './get-tool-detail-command'

describe('controllers/get-tool-detail', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['getToolDetailCommand', getToolDetailCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['getToolDetailCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
