import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mineProject } from '../../mining/mine-project.js'
import { loadProjectContext } from '../../project/context.js'
import { openProjectDatabase } from '../../storage/database.js'
import { mcpCallCommand } from './mcp.js'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('MCP call command', () => {
    it('executes mutating tools in dry-run memory by default', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-call-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')
        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''

        try {
            await mcpCallCommand(
                { project: projectRoot },
                'konteks_save',
                JSON.stringify({
                    chat: [
                        'User: The MCP debug call should return real tool output.',
                        'Assistant: Implemented dry-run memory execution for mutating tools.',
                        'User: Keep dry-run from persisting any session memory.',
                    ].join('\n'),
                }),
            )

            output = String(log.mock.calls[0]?.[0])
        } finally {
            log.mockRestore()
        }
        expect(output).toBe(
            'konteks: session saved, 1 diary entry, 1 durable memories.',
        )

        const adapter = await openProjectDatabase(context)
        const rows = await adapter.query<{ count: number }>(
            'select count(*) as count from diary_entries',
        )
        await adapter.close()
        expect(rows[0]?.count).toBe(0)
    })

    it('prints the raw MCP envelope when requested', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-call-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')
        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output: Record<string, unknown> = {}

        try {
            await mcpCallCommand(
                { project: projectRoot },
                'konteks_save',
                JSON.stringify({
                    chat: [
                        'User: The MCP debug call can print JSON when needed.',
                        'Assistant: Added a JSON flag for the raw MCP envelope.',
                        'User: Keep text output as the default CLI behavior.',
                    ].join('\n'),
                }),
                { json: true },
            )

            output = JSON.parse(String(log.mock.calls[0]?.[0]))
        } finally {
            log.mockRestore()
        }

        expect(output.content).toEqual(expect.any(Array))
        expect(JSON.stringify(output)).toContain('diaryId')
    })

    it('executes mutating tools with apply', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-call-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')
        const log = spyOn(console, 'log').mockImplementation(() => {})

        try {
            await expect(
                mcpCallCommand(
                    { project: projectRoot },
                    'konteks_save',
                    '{"chat":"Implemented status output."}',
                    { apply: true },
                ),
            ).rejects.toThrow('chat transcript is too short to save')
            expect(log).not.toHaveBeenCalled()
        } finally {
            log.mockRestore()
        }
    })
})
