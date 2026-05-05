import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDefaultConfig, resolveProjectContext } from './context.js'
import { getProjectStatus } from './status.js'

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-test-'))
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

describe('project context', () => {
    it('uses explicit project root overrides', async () => {
        const projectRoot = await makeTempProject()

        const context = await resolveProjectContext(projectRoot)

        expect(context.projectRoot).toBe(projectRoot)
        expect(context.memoryDir).toBe(join(projectRoot, '.konteks'))
        expect(context.configPath).toBe(
            join(projectRoot, '.konteks', 'config.json'),
        )
    })

    it('creates default config for the project-local memory directory', () => {
        expect(createDefaultConfig('/repo')).toEqual({
            projectRoot: '/repo',
            recall: {
                maxTokens: 2000,
            },
            storage: {
                inlinePayloadMaxBytes: 2048,
                memoryDir: '.konteks',
            },
        })
    })

    it('reports missing memory when the project is not initialized', async () => {
        const projectRoot = await makeTempProject()

        const status = await getProjectStatus(projectRoot)

        expect(status.freshness).toEqual({
            reason: 'Konteks project memory is not initialized.',
            recommendedCommand: 'konteks init',
            status: 'missing',
        })
    })

    it('reports missing extraction metadata when config exists', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')

        const status = await getProjectStatus(projectRoot)

        expect(status.freshness.status).toBe('missing')
        expect(status.freshness.recommendedCommand).toBe('konteks repair')
    })
})
