import { describe, expect, it } from 'bun:test'
import getToolsCommand from './get-tools-command'

describe('controllers/get-tools', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['getToolsCommand', getToolsCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['getToolsCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
