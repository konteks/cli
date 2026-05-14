import { describe, expect, it } from 'bun:test'
import {
    backupMemoryCommand,
    exportMemoryCommand,
    importMemoryCommand,
    restoreMemoryCommand,
} from './memory-transfer'

describe('controllers/memory-transfer', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['backupMemoryCommand', backupMemoryCommand, 'function'],
            ['exportMemoryCommand', exportMemoryCommand, 'function'],
            ['importMemoryCommand', importMemoryCommand, 'function'],
            ['restoreMemoryCommand', restoreMemoryCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'backupMemoryCommand',
            'exportMemoryCommand',
            'importMemoryCommand',
            'restoreMemoryCommand',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
