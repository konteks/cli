import { describe, expect, it } from 'bun:test'
import {
    exportDurableMemory,
    importDurableMemory,
} from './memory-transfer-store'

describe('providers/persistence/sqlite/memory-transfer-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['exportDurableMemory', exportDurableMemory, 'function'],
            ['importDurableMemory', importDurableMemory, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'exportDurableMemory',
            'importDurableMemory',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
