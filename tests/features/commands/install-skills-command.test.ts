import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import InstallSkillsCommand from '@/commands/install-skills-command'

const tempDirs: string[] = []

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

describe('InstallSkillsCommand', () => {
    it('installs Konteks skills', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-skills-'))
        tempDirs.push(projectRoot)
        await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')

        await withWorkingDirectory(projectRoot, () =>
            new InstallSkillsCommand().run({}),
        )

        expect(
            (await readdir(join(projectRoot, '.agents', 'skills'))).sort(),
        ).toEqual(['konteks-recall', 'konteks-save', 'konteks-warm-up'])
        const warmUp = await readFile(
            join(
                projectRoot,
                '.agents',
                'skills',
                'konteks-warm-up',
                'SKILL.md',
            ),
            'utf8',
        )

        expect(warmUp).toContain('name: konteks-warm-up')
        expect(warmUp).toContain('any free-form text provided')
        expect(warmUp).not.toContain('{{topic}}')
    })

    it('installs Konteks skills globally', async () => {
        const homeDir = await mkdtemp(join(tmpdir(), 'konteks-skills-home-'))
        tempDirs.push(homeDir)

        await new InstallSkillsCommand().run({ global: true, homeDir })

        await expect(
            readFile(
                join(homeDir, '.agents', 'skills', 'konteks-save', 'SKILL.md'),
                'utf8',
            ),
        ).resolves.toContain('name: konteks-save')
    })

    it('installs local skills into the current project by default', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-skills-'))
        tempDirs.push(projectRoot)
        await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')

        await withWorkingDirectory(projectRoot, () =>
            new InstallSkillsCommand().run({}),
        )

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
