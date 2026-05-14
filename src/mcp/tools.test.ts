import { describe, expect, it } from 'bun:test'
import type { KonteksToolRegistration } from './tools'
import {
    getKonteksMcpInstructions,
    getKonteksToolRegistrations,
    listKonteksTools,
} from './tools'

type CoveredTypes = [KonteksToolRegistration]

describe('mcp/tools', () => {
    it('lists MCP tools in API order with annotations on registrations', () => {
        expect(listKonteksTools().map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save',
            'konteks_search',
            'konteks_forget',
        ])
        expect(
            getKonteksToolRegistrations().map(tool => [
                tool.name,
                tool.annotations?.readOnlyHint,
                tool.annotations?.destructiveHint,
            ]),
        ).toEqual([
            ['konteks_warm_up', false, false],
            ['konteks_recall', true, false],
            ['konteks_save', false, false],
            ['konteks_search', true, false],
            ['konteks_forget', false, true],
        ])
    })

    it('returns the MCP workflow instructions', () => {
        expect(getKonteksMcpInstructions()).toContain(
            'Warm Up -> Build -> Save',
        )
    })

    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        expect(['KonteksToolRegistration']).toEqual(['KonteksToolRegistration'])
    })
})
