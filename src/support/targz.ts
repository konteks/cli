import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import CliUserError from './cli/cli-user-error'

const execFileAsync = promisify(execFile)

export async function createTarGz(
    sourceDir: string,
    outputPath: string,
): Promise<void> {
    await runTar(['-czf', outputPath, '-C', sourceDir, '.'])
}

export async function extractTarGz(
    inputPath: string,
    outputDir: string,
): Promise<void> {
    await runTar(['-xzf', inputPath, '-C', outputDir])
}

async function runTar(args: string[]): Promise<void> {
    try {
        await execFileAsync('tar', args)
    } catch (error) {
        throw new CliUserError({
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to execute the tar command.',
            title: 'Archive operation failed',
        })
    }
}
