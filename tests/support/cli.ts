import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { trackTempDir } from './project'

const execFileAsync = promisify(execFile)

export type CliResult = {
    exitCode: number | null
    output: string
}

export async function runBuiltCli(
    projectRoot: string,
    args: string[],
): Promise<CliResult> {
    const homeDir = trackTempDir(await mkdtemp(join(tmpdir(), 'konteks-home-')))
    const ioDir = trackTempDir(await mkdtemp(join(tmpdir(), 'konteks-io-')))
    const stdoutPath = join(ioDir, 'stdout.txt')
    const stderrPath = join(ioDir, 'stderr.txt')
    const command = [
        'node',
        shellQuote(join(process.cwd(), 'dist', 'main.js')),
        ...args.map(shellQuote),
        '>',
        shellQuote(stdoutPath),
        '2>',
        shellQuote(stderrPath),
    ].join(' ')

    try {
        await execFileAsync('sh', ['-lc', command], {
            cwd: projectRoot,
            env: isolatedCommandEnv(homeDir),
        })

        return {
            exitCode: 0,
            output: await readOutput(stdoutPath, stderrPath),
        }
    } catch (error) {
        const failure = error as { code?: number }

        return {
            exitCode: typeof failure.code === 'number' ? failure.code : null,
            output: await readOutput(stdoutPath, stderrPath),
        }
    }
}

export async function runSourceCli(
    projectRoot: string,
    args: string[],
    env: Record<string, string> = {},
): Promise<CliResult> {
    const proc = Bun.spawn(
        ['bun', join(process.cwd(), 'src/main.ts'), ...args],
        {
            cwd: projectRoot,
            env: { ...process.env, ...env },
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

export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`
}

async function readOutput(
    stdoutPath: string,
    stderrPath: string,
): Promise<string> {
    const [stdout, stderr] = await Promise.all([
        readFile(stdoutPath, 'utf8').catch(() => ''),
        readFile(stderrPath, 'utf8').catch(() => ''),
    ])

    return `${stdout}\n${stderr}`.trim()
}
