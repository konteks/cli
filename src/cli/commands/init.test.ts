import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    it('adds .konteks to .gitignore during init', async () => {
        const projectRoot = await makeTempProject()

        await initCommand({ project: projectRoot })

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

        await initCommand({ project: projectRoot })

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('node_modules\n.konteks/\n')
    })
})
