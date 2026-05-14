import { describe, expect, it } from 'bun:test'
import type {
    KonteksPromptRegistration,
    KonteksToolRegistration,
    ToolHandlers,
} from './mcp-surface'
import {
    callKonteksTool,
    createToolHandlers,
    getKonteksMcpInstructions,
    getKonteksPrompt,
    getKonteksPromptRegistrations,
    getKonteksToolRegistrations,
    listKonteksPrompts,
    listKonteksTools,
} from './mcp-surface'

type CoveredTypes = [
    KonteksPromptRegistration,
    KonteksToolRegistration,
    ToolHandlers,
]

describe('composition/mcp-surface', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['callKonteksTool', callKonteksTool, 'function'],
            ['createToolHandlers', createToolHandlers, 'function'],
            [
                'getKonteksMcpInstructions',
                getKonteksMcpInstructions,
                'function',
            ],
            ['getKonteksPrompt', getKonteksPrompt, 'function'],
            [
                'getKonteksPromptRegistrations',
                getKonteksPromptRegistrations,
                'function',
            ],
            [
                'getKonteksToolRegistrations',
                getKonteksToolRegistrations,
                'function',
            ],
            ['listKonteksPrompts', listKonteksPrompts, 'function'],
            ['listKonteksTools', listKonteksTools, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'callKonteksTool',
            'createToolHandlers',
            'getKonteksMcpInstructions',
            'getKonteksPrompt',
            'getKonteksPromptRegistrations',
            'getKonteksToolRegistrations',
            'listKonteksPrompts',
            'listKonteksTools',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'KonteksPromptRegistration',
            'KonteksToolRegistration',
            'ToolHandlers',
        ] as const
        expect(typeNames).toEqual([
            'KonteksPromptRegistration',
            'KonteksToolRegistration',
            'ToolHandlers',
        ])
    })
})
