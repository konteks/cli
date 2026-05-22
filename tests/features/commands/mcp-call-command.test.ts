import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import CallCommand from '@/entrypoints/cli/commands/mcp/call-command'
import mcpTools from '@/entrypoints/mcp/tools'
import { loadProjectContext } from '@/modules/project/context'
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

        let memoryDirDuringCall: string | undefined
        const saveTool = getTool('konteks_save_diary')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(saveTool, 'handle').mockImplementation(async () => {
            memoryDirDuringCall = memoryDir
            const configExists = await fileExists(
                join(memoryDir, 'config.json'),
            )

            return {
                content: [
                    {
                        text: `dry run config exists: ${configExists}`,
                        type: 'text',
                    },
                ],
            }
        })

        await withWorkingDirectory(projectRoot, () =>
            new CallCommand().handle({
                args: [
                    'konteks_save_diary',
                    '{"summary":"Dry run diary entry should not persist."}',
                ],
                options: {},
            }),
        )

        expect(memoryDirDuringCall).toBe(memoryDir)
        expect(logSpy).toHaveBeenCalledWith('dry run config exists: true')
        expect(await fileExists(memoryDir)).toBe(true)
    })

    it('restores the original memory directory when a dry-run tool fails', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-call-command-'),
        )
        const memoryDir = join(projectRoot, '.konteks')
        await mkdir(memoryDir, { recursive: true })
        await writeFile(join(memoryDir, 'config.json'), '{}\n')

        const saveTool = getTool('konteks_save_diary')
        spyOn(saveTool, 'handle').mockImplementation(async () => {
            const context = await loadProjectContext()
            await writeFile(
                join(context.memoryDir, 'dry-run-marker.txt'),
                'sandbox',
            )
            throw new Error('dry run boom')
        })

        await expect(
            withWorkingDirectory(projectRoot, () =>
                new CallCommand().handle({
                    args: [
                        'konteks_save_diary',
                        '{"summary":"Dry run diary entry should not persist."}',
                    ],
                    options: {},
                }),
            ),
        ).rejects.toThrow('dry run boom')

        expect(await fileExists(join(memoryDir, 'config.json'))).toBe(true)
        expect(await fileExists(join(memoryDir, 'dry-run-marker.txt'))).toBe(
            false,
        )
    })

    it('calls read-only tools directly without dry run', async () => {
        let calledInput: unknown
        const recallTool = getTool('konteks_recall')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(recallTool, 'handle').mockImplementation(async input => {
            calledInput = input
            return {
                content: [{ text: 'direct', type: 'text' }],
            }
        })

        await new CallCommand().handle({
            args: ['konteks_recall', '{"task":"abc"}'],
            options: {},
        })

        expect(calledInput).toEqual({ task: 'abc' })
        expect(logSpy).toHaveBeenCalledWith('direct')
    })

    it('calls mutating tools directly when apply is enabled', async () => {
        let called = false
        const saveTool = getTool('konteks_save_diary')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        spyOn(saveTool, 'handle').mockImplementation(async () => {
            called = true
            return {
                content: [{ text: 'apply', type: 'text' }],
            }
        })

        await new CallCommand().handle({
            args: [
                'konteks_save_diary',
                '{"summary":"Apply diary entry should persist to project memory."}',
            ],
            options: { apply: true },
        })

        expect(called).toBe(true)
        expect(logSpy).toHaveBeenCalledWith('apply')
    })
})

async function withWorkingDirectory<T>(
    cwd: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(cwd)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

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
