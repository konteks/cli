import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { trackTempDir } from './project'

export type CliResult = {
    exitCode: number | null
    output: string
}

export async function runBuiltCli(
    projectRoot: string,
    args: string[],
): Promise<CliResult> {
    const homeDir = trackTempDir(await mkdtemp(join(tmpdir(), 'konteks-home-')))
    const proc = Bun.spawn(
        [process.execPath, join(process.cwd(), 'dist/main.js'), ...args],
        {
            cwd: projectRoot,
            env: isolatedCommandEnv(homeDir),
            stderr: 'pipe',
            stdout: 'pipe',
        },
    )
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ])

    return {
        exitCode,
        output: `${stdout}\n${stderr}`.trim(),
    }
}

export async function runSourceCli(
    projectRoot: string,
    args: string[],
    env: Record<string, string> = {},
): Promise<CliResult> {
    const homeDir = trackTempDir(await mkdtemp(join(tmpdir(), 'konteks-home-')))
    const proc = Bun.spawn(
        [process.execPath, join(process.cwd(), 'src/main.ts'), ...args],
        {
            cwd: projectRoot,
            env: { ...isolatedCommandEnv(homeDir), ...env },
            stderr: 'pipe',
            stdout: 'pipe',
        },
    )
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

export function isolatedCommandEnv(homeDir: string): Record<string, string> {
    return {
        ...Object.fromEntries(
            Object.entries(process.env).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
            ),
        ),
        HOME: homeDir,
        KONTEKS_MODEL_CACHE_DIR: join(homeDir, '.cache', 'konteks', 'models'),
        KONTEKS_SQLITE_TEST_DATABASE: 'file',
        NO_COLOR: '1',
    }
}
