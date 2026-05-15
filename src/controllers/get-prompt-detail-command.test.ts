import { describe, expect, it } from 'bun:test'
import getPromptDetailCommand from './get-prompt-detail-command'

describe('controllers/get-prompt-detail', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['getPromptDetailCommand', getPromptDetailCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['getPromptDetailCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
