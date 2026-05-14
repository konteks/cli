import { describe, expect, it } from 'bun:test'
import {
    forgetMemory,
    recallMemory,
    saveMemory,
    searchMemory,
    warmUpMemory,
} from './memory-operations'

describe('composition/memory-operations', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['forgetMemory', forgetMemory, 'function'],
            ['recallMemory', recallMemory, 'function'],
            ['saveMemory', saveMemory, 'function'],
            ['searchMemory', searchMemory, 'function'],
            ['warmUpMemory', warmUpMemory, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'forgetMemory',
            'recallMemory',
            'saveMemory',
            'searchMemory',
            'warmUpMemory',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
