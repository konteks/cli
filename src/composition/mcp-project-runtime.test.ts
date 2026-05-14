import { describe, expect, it } from 'bun:test'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabase,
    withProjectDatabaseContext,
} from './mcp-project-runtime'

describe('composition/mcp-project-runtime', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['loadMcpProjectContext', loadMcpProjectContext, 'function'],
            [
                'updateChangedProjectMemorySilently',
                updateChangedProjectMemorySilently,
                'function',
            ],
            ['withProjectDatabase', withProjectDatabase, 'function'],
            [
                'withProjectDatabaseContext',
                withProjectDatabaseContext,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'loadMcpProjectContext',
            'updateChangedProjectMemorySilently',
            'withProjectDatabase',
            'withProjectDatabaseContext',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
