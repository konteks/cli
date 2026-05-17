import { afterEach, describe, expect, it, mock } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import FakeEmbeddingProvider from '../../fake/fake-embedding-provider'

class MockHuggingFaceEmbeddingProvider extends FakeEmbeddingProvider {
    public constructor(_options?: unknown) {
        super()
    }
}

mock.module('@/providers/embeddings/hugging-face-embedding-provider', () => ({
    default: MockHuggingFaceEmbeddingProvider,
}))

mock.module('@inquirer/prompts', () => ({
    checkbox: async () => [],
    confirm: async () => true,
    select: async () => 'grammars',
}))

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-init-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
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

describe('InitCommand', () => {
    const init = (project: string) =>
        withWorkingDirectory(project, () =>
            createCommand().then(command =>
                command.handle({
                    args: [],
                    options: {},
                }),
            ),
        )

    it('adds .konteks to .gitignore during init', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('.konteks/\n')
    })

    it('preserves existing .gitignore entries', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(join(projectRoot, '.gitignore'), 'node_modules\n')

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('node_modules\n.konteks/\n')
    })

    it('does not duplicate existing .konteks ignore entries', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(
            join(projectRoot, '.gitignore'),
            'node_modules\n.konteks/\n',
        )

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('node_modules\n.konteks/\n')
    })

    it('skips when the project is already initialized', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)
        const manifestPath = join(projectRoot, '.konteks', 'mine-manifest.json')
        const firstManifest = await readFile(manifestPath, 'utf8')

        await init(projectRoot)

        const secondManifest = await readFile(manifestPath, 'utf8')
        expect(secondManifest).toBe(firstManifest)
    })

    it('finishes setup when a previous init stopped before extraction', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')

        await init(projectRoot)

        await expect(
            readFile(
                join(projectRoot, '.konteks', 'mine-manifest.json'),
                'utf8',
            ),
        ).resolves.toContain('"version": 1')
    })

    it('continues from existing sections when the manifest is missing', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)
        const manifestPath = join(projectRoot, '.konteks', 'mine-manifest.json')
        const firstManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        await rm(manifestPath)

        await init(projectRoot)

        const resumedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        expect(resumedManifest.diagnostics.chunkCount).toBe(
            firstManifest.diagnostics.chunkCount,
        )
        expect(
            resumedManifest.diagnostics.embeddingReusedCount,
        ).toBeGreaterThan(0)
    })
})

async function createCommand() {
    const { default: InitCommand } = await import('@/commands/init-command')
    return new InitCommand()
}
