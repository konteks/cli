import { afterEach, describe, expect, it } from 'bun:test'
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    unlink,
    writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    getExtractionFreshness,
    readExtractionManifest,
} from '@/modules/extraction/engine/manifest'
import { extractProject } from '@/modules/extraction/extract-project'
import createToonStore from '@/modules/persistence/objects/create-toon-store'
import { loadProjectContext } from '@/modules/project/context'

const tempDirs: string[] = []
const originalCwd = process.cwd()

async function extractTestProject(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
    mode: Parameters<typeof extractProject>[1],
    options: Parameters<typeof extractProject>[2] = {},
) {
    return await withProjectRoot(context.projectRoot, () =>
        extractProject(context, mode, options),
    )
}

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-extract-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
    await writeFile(
        join(projectRoot, 'src', 'index.txt'),
        'Konteks fixture notes for extraction tests.\n',
    )
    await writeFile(join(projectRoot, '.env.local'), 'SECRET=hidden\n')

    process.chdir(projectRoot)
    return projectRoot
}

afterEach(async () => {
    process.chdir(originalCwd)
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('extractProject', () => {
    it('writes a manifest and TOON project summary', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const result = await extractTestProject(context, 'rebuild')
        const manifest = await readExtractionManifest(context.memoryDir)
        const summary = await createToonStore(context.memoryDir).read(
            result.summaryRef,
        )

        expect(result.ok).toBe(true)
        expect(result.fileCount).toBe(2)
        expect(result.sectionCount).toBeGreaterThan(1)
        expect(result.technologies).toEqual([])
        expect(manifest?.summaryRef).toBe(result.summaryRef)
        expect(manifest?.diagnostics).toMatchObject({
            detectedParserLanguages: [],
            filesIncluded: 2,
            filesSkipped: {
                secret: 1,
            },
            filesTruncatedBySectionLimit: 0,
            sectionCount: result.sectionCount,
        })
        expect(manifest?.files.map(file => file.path)).toEqual([
            'README.md',
            'src/index.txt',
        ])
        expect(summary).toContain('README.md')
        expect(summary).not.toContain('.env.local')
    })

    it('reports fresh status after extraction and stale after a file change', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractTestProject(context, 'rebuild')

        const fresh = await getExtractionFreshness(context)
        expect(fresh.status).toBe('fresh')

        await writeFile(
            join(projectRoot, 'src', 'new.txt'),
            'export const x = 1\n',
        )

        const stale = await getExtractionFreshness(context)
        expect(stale.status).toBe('stale')
        expect(stale.recommendedCommand).toBe('konteks rebuild')
    })

    it('caps sections per file and reports the diagnostic', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'src', 'many.md'),
            Array.from({ length: 205 }, (_, index) => [
                `## Section ${index}`,
                `value ${index}`,
            ])
                .flat()
                .join('\n'),
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const result = await extractTestProject(context, 'rebuild')
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(result.sectionCount).toBeGreaterThanOrEqual(200)
        expect(manifest?.diagnostics?.filesTruncatedBySectionLimit).toBe(1)
    })

    it('stores the manifest as local JSON', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'changed')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'extraction-manifest.json'),
            'utf8',
        )
        expect(JSON.parse(rawManifest).mode).toBe('changed')
    })

    it('reads legacy reindex manifests for compatibility', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractTestProject(context, 'rebuild')
        const manifestPath = join(
            projectRoot,
            '.konteks',
            'extraction-manifest.json',
        )
        const rawManifest = await readFile(manifestPath, 'utf8')
        await writeFile(
            manifestPath,
            rawManifest.replace('"mode": "rebuild"', '"mode": "reindex"'),
        )

        expect((await readExtractionManifest(context.memoryDir))?.mode).toBe(
            'reindex',
        )
        await expect(getExtractionFreshness(context)).resolves.toMatchObject({
            status: 'fresh',
        })

        await writeFile(join(projectRoot, 'src', 'new.txt'), 'changed\n')
        await expect(
            extractTestProject(context, 'changed'),
        ).resolves.toMatchObject({
            ok: true,
        })
    })

    it('extracts package.json with bundled config grammars', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'package.json'),
            '{"name":"fixture","type":"module"}\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const result = await extractTestProject(context, 'rebuild')
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(result.ok).toBe(true)
        expect(manifest?.files.map(file => file.path)).toContain('package.json')
    })

    it('stores rebuild mode in manifest', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'rebuild')
        await extractTestProject(context, 'rebuild')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'extraction-manifest.json'),
            'utf8',
        )
        const manifest = JSON.parse(rawManifest)

        expect(manifest.mode).toBe('rebuild')
        expect(manifest.diagnostics.sectionCount).toBeGreaterThan(0)
    })

    it('changed mode removes deleted-file sections and preserves unchanged sections', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'rebuild')

        await unlink(join(projectRoot, 'README.md'))
        await writeFile(
            join(projectRoot, 'src', 'new.txt'),
            'export const n = 1\n',
        )
        await extractTestProject(context, 'changed')
        const manifest = await readExtractionManifest(context.memoryDir)
        const paths = manifest?.files.map(file => file.path) ?? []

        expect(paths).not.toContain('README.md')
        expect(paths).toContain('src/index.txt')
        expect(paths).toContain('src/new.txt')
    })

    it('extracts repeated anchors with identical content without section ID collisions', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'README.md'),
            ['# Repeat', 'same content', '# Repeat', 'same content'].join('\n'),
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const result = await extractTestProject(context, 'rebuild')
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(manifest?.diagnostics?.sectionCount).toBe(result.sectionCount)
        expect(result.sectionCount).toBeGreaterThanOrEqual(3)
    })

    it('fails when a required Tree-sitter parser fails', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await expect(extractProject(context, 'rebuild')).resolves.toMatchObject(
            {
                ok: true,
            },
        )
    })
})

async function withProjectRoot<T>(
    projectRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(projectRoot)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}
