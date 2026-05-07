import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { skillsInstallCommand } from './skills.js'

const tempDirs: string[] = []

beforeAll(async () => {
    await $`bun scripts/build-skills.ts`.quiet()
})

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

afterAll(async () => {
    await rm(join(process.cwd(), 'dist', 'skills'), {
        force: true,
        recursive: true,
    })
})

describe('skills install command', () => {
    it('installs Konteks skills', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-skills-'))
        tempDirs.push(projectRoot)

        await skillsInstallCommand({ project: projectRoot })

        expect(
            (await readdir(join(projectRoot, '.agents', 'skills'))).sort(),
        ).toEqual([
            'konteks-recall',
            'konteks-save',
            'konteks-warm-up',
            'konteks-work-on-existing',
            'konteks-work-on-new',
        ])
        await expect(
            readFile(
                join(
                    projectRoot,
                    '.agents',
                    'skills',
                    'konteks-warm-up',
                    'SKILL.md',
                ),
                'utf8',
            ),
        ).resolves.toContain('name: konteks-warm-up')
    })

    it('installs Konteks skills globally', async () => {
        const homeDir = await mkdtemp(join(tmpdir(), 'konteks-skills-home-'))
        tempDirs.push(homeDir)

        await skillsInstallCommand({ global: true, homeDir })

        await expect(
            readFile(
                join(homeDir, '.agents', 'skills', 'konteks-save', 'SKILL.md'),
                'utf8',
            ),
        ).resolves.toContain('name: konteks-save')
    })

    it('uses the project override for local install by default', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-skills-'))
        tempDirs.push(projectRoot)

        await skillsInstallCommand({ project: projectRoot })

        await expect(
            readFile(
                join(
                    projectRoot,
                    '.agents',
                    'skills',
                    'konteks-recall',
                    'SKILL.md',
                ),
                'utf8',
            ),
        ).resolves.toContain('konteks_recall')
    })
})
