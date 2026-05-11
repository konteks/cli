import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callMcpTool } from '@/controllers/mcp/serve'
import { FakeEmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider'
import { loadProjectContext } from '@/infrastructure/file-system/context'
import { mineProject } from '@/infrastructure/mining/mine-project'
import { mkdtemp, rm } from '@/services/file-manager'
import { callMcpToolCommand } from './call-mcp-tool'

describe('MCP call command', () => {
    let tempDirs: string[] = []

    afterEach(async () => {
        for (const dir of tempDirs) {
            await rm(dir, { force: true, recursive: true })
        }
        tempDirs = []
    })

    it('executes mutating tools in dry-run memory by default', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-call-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''
        try {
            await callMcpToolCommand(
                { project: projectRoot },
                'konteks_save',
                '{"memories":[{"content":"Use dry-run by default for mutated tools.","kind":"decision","type":"memory"}],"type":"memories"}',
            )
            output = String(log.mock.calls[0]?.[0])
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('konteks: session saved')
        expect(output).toContain('1 durable memories')

        const search = await callMcpTool(
            { project: projectRoot },
            'konteks_search',
            { query: 'dry-run' },
        )
        expect(JSON.stringify(search)).not.toContain('Use dry-run by default')
    })

    it('executes mutating tools with apply', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-call-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''
        try {
            await callMcpToolCommand(
                { project: projectRoot },
                'konteks_save',
                '{"memories":[{"content":"Apply mutations to real project memory.","kind":"decision","type":"memory"}],"type":"memories"}',
                { apply: true },
            )
            output = String(log.mock.calls[0]?.[0])
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('konteks: session saved')

        const search = await callMcpTool(
            { project: projectRoot },
            'konteks_search',
            { query: 'Apply mutations' },
        )
        expect(JSON.stringify(search)).toContain('Apply mutations')

        await expect(
            callMcpToolCommand(
                { project: projectRoot },
                'konteks_save',
                '{"content":"too short","kind":"note","type":"memory"}',
                { apply: true },
            ),
        ).rejects.toThrow()
    })

    it('exposes JSON output for tool calls', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-json-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output: Record<string, unknown>
        try {
            await callMcpToolCommand(
                { project: projectRoot },
                'konteks_recall',
                '{"task":"auth session refresh"}',
                { json: true },
            )
            output = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<
                string,
                unknown
            >
        } finally {
            log.mockRestore()
        }

        expect(output.content).toEqual(expect.any(Array))
        expect(JSON.stringify(output)).toContain('recall:')
    })
})
