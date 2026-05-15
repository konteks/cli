import { describe, expect, it } from 'bun:test'
import storePayload from './store-payload'

describe('providers/persistence/objects/payload', () => {
    it('matches the public runtime contract', () => {
        const cases = [['storePayload', storePayload, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['storePayload'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
