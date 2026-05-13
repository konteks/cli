import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VERSION } from '@/support/version'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('CLI initialization middleware', () => {
    for (const args of [
        ['status'],
        ['config'],
        ['repair'],
        ['install-skills'],
        ['mcp'],
        ['mcp', 'tools'],
        ['mcp', 'tool', 'konteks_warm_up'],
        ['mcp', 'prompts'],
        ['mcp', 'prompt', 'konteks-warm-up'],
        ['mcp', 'call', 'konteks_warm_up'],
    ]) {
        it(`blocks ${args.join(' ')} when project memory is not initialized`, async () => {
            const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-cli-'))
            tempDirs.push(projectRoot)

            const result = await runKonteks(['--project', projectRoot, ...args])

            expect(result.exitCode).not.toBe(0)
            if (!args[0]?.startsWith('mcp')) {
                expect(result.output).toContain(`Konteks v${VERSION}`)
            }
            expect(result.output).toContain('Konteks memory is not initialized')
            expect(result.output).toContain('Project memory is missing')
            expect(result.output).toContain('konteks init')
            expect(result.output).not.toContain(
                'at ensureCliProjectInitialized',
            )
        })
    }

    it('renders the initialization error with color when color is forced', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-cli-'))
        tempDirs.push(projectRoot)

        const result = await runKonteks(['--project', projectRoot, 'status'], {
            FORCE_COLOR: '1',
            NO_COLOR: '',
        })

        expect(result.exitCode).not.toBe(0)
        expect(result.output).toContain(`Konteks v${VERSION}`)
        expect(result.output).toContain('\u001b[31m')
        expect(result.output).toContain('╭─')
    })
})

async function runKonteks(
    args: string[],
    env: Record<string, string> = {},
): Promise<{
    exitCode: number | null
    output: string
}> {
    const proc = Bun.spawn(['bun', 'src/main.ts', ...args], {
        env: { ...process.env, ...env },
        stderr: 'pipe',
        stdout: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ])

    return {
        exitCode,
        output: `${stdout}\n${stderr}`,
    }
}
