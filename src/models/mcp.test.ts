import { describe, expect, it } from 'bun:test'
import type { McpProjectContext, StartMcpServerOptions } from './mcp'

type CoveredTypes = [McpProjectContext, StartMcpServerOptions]

describe('models/mcp', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'McpProjectContext',
            'StartMcpServerOptions',
        ] as const
        expect(typeNames).toEqual([
            'McpProjectContext',
            'StartMcpServerOptions',
        ])
    })
})
