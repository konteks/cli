import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import CallCommand from '@/commands/mcp/call-command'
import mcpTools from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'
import { terminal } from '@/support/terminal/service'

describe('commands/mcp/call', () => {
    afterEach(() => {
        mock.restore()
    })

    it('runs mutating tools against a copied temp memory dir and rewrites paths back', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-call-command-'),
        )
        const memoryDir = join(projectRoot, '.konteks')
        await mkdir(memoryDir, { recursive: true })
        await writeFile(join(memoryDir, 'config.json'), '{}\n')

        let calledOptions: StartMcpServerOptions | undefined
        let tempMemoryExistedDuringCall = false
        const saveTool = getTool('konteks_save')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(saveTool, 'handle').mockImplementation(async options => {
            calledOptions = options
            tempMemoryExistedDuringCall = await fileExists(
                join(options.memoryDir ?? '', 'config.json'),
            )

            return {
                content: [
                    {
                        text: `temp path: ${options.memoryDir}`,
                        type: 'text',
                    },
                ],
            }
        })

        await new CallCommand().handle({
            args: ['konteks_save', '{"type":"diary"}'],
            globalOptions: { project: projectRoot },
            options: {},
        })

        expect(calledOptions?.memoryDir).not.toBe(memoryDir)
        expect(calledOptions?.project).toBe(projectRoot)
        expect(tempMemoryExistedDuringCall).toBe(true)
        expect(logSpy).toHaveBeenCalledWith(`temp path: ${memoryDir}`)
        expect(await fileExists(calledOptions?.memoryDir ?? '')).toBe(false)
    })

    it('calls read-only tools directly without dry run', async () => {
        let calledOptions: StartMcpServerOptions | undefined
        let calledInput: unknown
        const recallTool = getTool('konteks_recall')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(recallTool, 'handle').mockImplementation(
            async (options, input) => {
                calledOptions = options
                calledInput = input
                return {
                    content: [{ text: 'direct', type: 'text' }],
                }
            },
        )

        await new CallCommand().handle({
            args: ['konteks_recall', '{"task":"abc"}'],
            globalOptions: { project: '/tmp/project' },
            options: {},
        })

        expect(calledOptions).toEqual({ project: '/tmp/project' })
        expect(calledInput).toEqual({ task: 'abc' })
        expect(logSpy).toHaveBeenCalledWith('direct')
    })

    it('calls mutating tools directly when apply is enabled', async () => {
        let calledOptions: StartMcpServerOptions | undefined
        const saveTool = getTool('konteks_save')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(saveTool, 'handle').mockImplementation(async options => {
            calledOptions = options
            return {
                content: [{ text: 'apply', type: 'text' }],
            }
        })

        await new CallCommand().handle({
            args: ['konteks_save', undefined],
            globalOptions: { project: '/tmp/project' },
            options: { apply: true },
        })

        expect(calledOptions).toEqual({ project: '/tmp/project' })
        expect(logSpy).toHaveBeenCalledWith('apply')
    })
})

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

function getTool(name: string) {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return tool
}
