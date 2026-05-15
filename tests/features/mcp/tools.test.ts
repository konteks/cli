import { describe, expect, it } from 'bun:test'
import z from 'zod'
import BaseMcpTool from '@/mcp/tools/_base-mcp-tool'
import ForgetMcpTool from '@/mcp/tools/forget-mcp-tool'
import mcpTools from '@/mcp/tools/index'
import RecallMcpTool from '@/mcp/tools/recall-mcp-tool'
import SaveMcpTool from '@/mcp/tools/save-mcp-tool'
import SearchMcpTool from '@/mcp/tools/search-mcp-tool'
import WarmUpMcpTool from '@/mcp/tools/warm-up-mcp-tool'
import type { WarmUpResult } from '@/memory/warm-up-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import type {
    ForgetResult,
    MemorySearchResult,
    RecallPackage,
    SaveResult,
} from '@/models/memory'

describe('MCP tools', () => {
    it('registers tools in API order with protocol annotations', () => {
        expect(mcpTools.map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save',
            'konteks_search',
            'konteks_forget',
        ])
        expect(
            mcpTools.map(tool => [
                tool.name,
                tool.annotations.readOnlyHint,
                tool.annotations.destructiveHint,
            ]),
        ).toEqual([
            ['konteks_warm_up', false, false],
            ['konteks_recall', true, false],
            ['konteks_save', false, false],
            ['konteks_search', true, false],
            ['konteks_forget', false, true],
        ])
        expect(mcpTools.every(tool => tool instanceof BaseMcpTool)).toBe(true)
    })

    it('validates input before executing a tool', async () => {
        class FixtureTool extends BaseMcpTool<{ value: string }> {
            annotations = {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            }
            description = 'Fixture tool.'
            inputSchema = z.object({ value: z.string().min(1) })
            name = 'konteks_search' as const

            protected override async execute(
                _options: StartMcpServerOptions,
                input: { value: string },
            ) {
                return this.formatOutput(input)
            }
        }

        const tool = new FixtureTool()

        await expect(tool.handle({}, {})).rejects.toThrow()
        await expect(tool.handle({}, { value: 'ok' })).resolves.toEqual({
            content: [{ text: 'value: ok', type: 'text' }],
        })
    })

    it('passes warm-up options through and formats warm-up output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new WarmUpMcpTool(async (options, input) => {
            receivedOptions = options
            expect(input.topic).toBe('routing')
            return warmUpResult()
        })

        const output = await textOutput(
            tool.handle({ project: '/repo' }, { topic: 'routing' }),
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        expect(output).toContain('warm_up:')
        expect(output).toContain('Test summary')
    })

    it('validates recall input and formats recall output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new RecallMcpTool(async (options, input) => {
            receivedOptions = options
            expect(input.task).toBe('task')
            return recallPackage()
        })

        await expect(tool.handle({}, {})).rejects.toThrow()
        const output = await textOutput(
            tool.handle({ project: '/repo' }, { task: 'task' }),
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        expect(output).toContain('recall:')
        expect(output).toContain('task: task')
    })

    it('validates save input and formats save output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new SaveMcpTool(async (options): Promise<SaveResult> => {
            receivedOptions = options
            return {
                accepted: true,
                diaryId: 'diary-1',
                id: 'diary-1',
            }
        })

        await expect(tool.handle({}, { type: 'diary' })).rejects.toThrow()
        const output = await textOutput(
            tool.handle(
                { project: '/repo' },
                {
                    summary:
                        'This diary entry has enough words to save safely.',
                    type: 'diary',
                },
            ),
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        expect(output).toBe('konteks: session saved, 1 diary entry.')
    })

    it('validates search input and formats search output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new SearchMcpTool(async options => {
            receivedOptions = options
            return [memoryResult()]
        })

        await expect(tool.handle({}, {})).rejects.toThrow()
        const output = await textOutput(
            tool.handle({ project: '/repo' }, { query: 'command' }),
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        expect(output).toContain('search:')
        expect(output).toContain('query: command')
    })

    it('validates forget input and formats forget output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new ForgetMcpTool(
            async (options): Promise<ForgetResult> => {
                receivedOptions = options
                return {
                    accepted: true,
                    affectedIds: ['memory-1'],
                    mode: 'soft_delete',
                }
            },
        )

        await expect(tool.handle({}, {})).rejects.toThrow()
        const output = await textOutput(
            tool.handle({ project: '/repo' }, { id: 'memory-1' }),
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        expect(output).toContain('accepted: true')
        expect(output).toContain('memory-1')
    })
})

async function textOutput(
    result: Promise<{ content: Array<{ text?: string; type: string }> }>,
): Promise<string> {
    const output = (await result).content[0]
    if (output?.type !== 'text' || typeof output.text !== 'string') {
        throw new Error('Expected text MCP output')
    }
    return output.text
}

function warmUpResult(): WarmUpResult {
    return {
        warmUp: {
            architecture: [],
            entryPoints: [],
            guidance: [],
            highlights: [],
            keyFiles: [],
            summary: 'Test summary',
            taxonomy: [],
            technologies: ['TypeScript'],
        },
    }
}

function recallPackage(): RecallPackage {
    return {
        brief: ['Use command classes.'],
        graph: [],
        history: [],
        memories: [],
        primaryTargets: [],
        quality: 'partial',
        sourceCount: 0,
        task: 'task',
        tokenBudget: 2000,
    }
}

function memoryResult(): MemorySearchResult {
    return {
        createdAt: '2026-05-16T00:00:00.000Z',
        excerpt: 'Command class architecture',
        id: 'memory-1',
        score: 100,
        type: 'memory',
    }
}
