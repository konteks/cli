import { afterEach, describe, expect, it } from 'bun:test'
import {
    chmod,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendProjectErrorLog } from '@/support/error-log'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('error log', () => {
    it('appends redacted human-readable error entries under .konteks', async () => {
        const projectRoot = await makeProjectRoot()
        const cause = new Error('inner failed password=secret-value')

        const result = await withWorkingDirectory(projectRoot, () =>
            appendProjectErrorLog({
                error: new Error('request failed bearer abcdef123456', {
                    cause,
                }),
                metadata: {
                    apiKey: 'sk-1234567890abcdef1234567890abcdef',
                    nested: {
                        token: 'secret-value',
                    },
                    toolName: 'fixture_tool',
                },
                surface: 'mcp_tool',
            }),
        )

        expect(result).toMatchObject({
            path: join(projectRoot, '.konteks', 'errors.log'),
            written: true,
        })

        const raw = await readFile(result.path ?? '', 'utf8')

        expect(raw).toContain('='.repeat(80))
        expect(raw).toContain('mcp_tool  fixture_tool')
        expect(raw).toContain('Error: request failed bearer [REDACTED]')
        expect(raw).toContain('Metadata:')
        expect(raw).toContain('  apiKey: [REDACTED]')
        expect(raw).toContain('  toolName: fixture_tool')
        expect(raw).toContain('"token": "[REDACTED]"')
        expect(raw).toContain('Process:')
        expect(raw).toContain('Stack:')
        expect(raw).toContain('Cause 1:')
        expect(raw).toContain('inner failed password=[REDACTED]')
        expect(raw).not.toContain('secret-value')
        expect(raw).not.toContain('abcdef123456')
        expect(raw).not.toContain('sk-1234567890abcdef')
    })

    it('does not throw when the log cannot be written', async () => {
        const projectRoot = await makeProjectRoot()
        const memoryDir = join(projectRoot, '.konteks')
        await mkdir(memoryDir, { recursive: true })
        await chmod(memoryDir, 0o400)

        const result = await withWorkingDirectory(projectRoot, () =>
            appendProjectErrorLog({
                error: new Error('write should fail'),
                surface: 'cli',
            }),
        )

        expect(result.written).toBe(false)
        await chmod(memoryDir, 0o700)
    })
})

async function makeProjectRoot(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-error-log-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')
    return projectRoot
}

async function withWorkingDirectory<T>(
    cwd: string,
    operation: () => Promise<T> | T,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(cwd)
    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}
