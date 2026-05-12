import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, mkdtemp, rm, writeFile } from '@/app/support/file-manager'
import { scanProjectFiles, scanProjectFilesWithDiagnostics } from './file-scan'

const tempDirs: string[] = []

async function makeProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-scan-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(join(projectRoot, 'docs', 'private'), { recursive: true })
    await mkdir(join(projectRoot, 'tmp'), { recursive: true })
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

describe('scanProjectFiles', () => {
    it('respects .gitignore and .konteksignore while keeping safe files', async () => {
        const projectRoot = await makeProject()
        await writeFile(join(projectRoot, '.gitignore'), 'tmp/\n*.log\n')
        await writeFile(join(projectRoot, '.konteksignore'), 'docs/private/\n')
        await writeFile(join(projectRoot, 'src', 'index.ts'), 'export {}\n')
        await writeFile(join(projectRoot, 'tmp', 'cache.ts'), 'ignored\n')
        await writeFile(join(projectRoot, 'debug.log'), 'ignored\n')
        await writeFile(
            join(projectRoot, 'docs', 'private', 'notes.md'),
            'ignored\n',
        )

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)

        expect(scan.files.map(file => file.path)).toEqual([
            '.gitignore',
            '.konteksignore',
            'package.json',
            'src/index.ts',
        ])
        expect(scan.files.every(file => file.contentHash.length === 64)).toBe(
            true,
        )
        expect(scan.diagnostics.filesIncluded).toBe(4)
        expect(scan.diagnostics.filesSkipped.vcsIgnore).toBe(2)
        expect(scan.diagnostics.filesSkipped.konteksignore).toBe(1)
    })

    it('skips large files', async () => {
        const projectRoot = await makeProject()
        await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
        await writeFile(join(projectRoot, 'huge.txt'), 'x'.repeat(20))

        const files = await scanProjectFiles(projectRoot, { maxFileBytes: 10 })

        expect(files.map(file => file.path)).toEqual(['README.md'])
    })
})
