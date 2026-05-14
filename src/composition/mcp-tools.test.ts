import { describe, expect, it } from 'bun:test'
import {
    callKonteksTool,
    dryRunKonteksTool,
    listKonteksTools,
} from './mcp-tools'

describe('composition/mcp-tools', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['callKonteksTool', callKonteksTool, 'function'],
            ['dryRunKonteksTool', dryRunKonteksTool, 'function'],
            ['listKonteksTools', listKonteksTools, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'callKonteksTool',
            'dryRunKonteksTool',
            'listKonteksTools',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
