import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeEmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider.js'
import { ensureKonteksGitignore, initCommand } from './init.js'

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-init-test-'))
    tempDirs.push(projectRoot)
    await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')
    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('init command', () => {
    const init = (project: string) =>
        initCommand({ embeddingProvider: new FakeEmbeddingProvider(), project })

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

        await ensureKonteksGitignore(projectRoot)

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
