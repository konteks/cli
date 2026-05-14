import { describe, expect, it } from 'bun:test'
import { saveKonteksInput } from './save-store'

describe('providers/persistence/sqlite/save-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['saveKonteksInput', saveKonteksInput, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['saveKonteksInput'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
