import { describe, expect, it } from 'bun:test'
import getPromptsCommand from './get-prompts-command'

describe('controllers/get-prompts', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['getPromptsCommand', getPromptsCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['getPromptsCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
