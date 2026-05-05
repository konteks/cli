import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProjectFilesWithDiagnostics } from './file-scan.js'
import { extractProjectMetadata } from './metadata.js'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('extractProjectMetadata', () => {
    it('extracts package, dependency, and workspace metadata', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'packages', 'app'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { react: '^19.0.0' },
                    devDependencies: { typescript: '^6.0.0' },
                    name: 'workspace-fixture',
                    optionalDependencies: { sharp: '^1.0.0' },
                    packageManager: 'bun@1.3.12',
                    peerDependencies: { zod: '^4.0.0' },
                    scripts: { test: 'bun test' },
                    workspaces: ['packages/*'],
                },
                null,
                2,
            ),
        )
        await writeFile(join(projectRoot, 'turbo.json'), '{}\n')
        await writeFile(join(projectRoot, 'packages', 'app', 'index.ts'), '')

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata).toMatchObject({
            dependencies: ['react'],
            devDependencies: ['typescript'],
            name: 'workspace-fixture',
            optionalDependencies: ['sharp'],
            packageManager: 'bun@1.3.12',
            peerDependencies: ['zod'],
            scripts: ['test'],
            workspaceGlobs: ['packages/*'],
            workspaceManager: 'turbo',
        })
    })
})
