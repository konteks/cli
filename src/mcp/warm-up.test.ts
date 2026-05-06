import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeEmbeddingProvider } from '../mining/embedding-provider.js'
import { mineProject } from '../mining/mine-project.js'
import { loadProjectContext } from '../project/context.js'
import { callMcpTool } from './server.js'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('konteks_warm_up', () => {
    it('returns stable project context assembled from stored artifacts', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { commander: '^14.0.0' },
                    name: 'warm-up-fixture',
                    packageManager: 'bun@1.3.12',
                },
                null,
                2,
            ),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const hello = () => "world"\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const payload = (result.structuredContent ?? {}) as Record<
            string,
            unknown
        >

        expect(payload.summary).toEqual(expect.any(String))
        expect(payload.technologies).toEqual(
            expect.arrayContaining(['javascript', 'typescript']),
        )
        expect(payload.keyFiles).toEqual(
            expect.arrayContaining(['package.json']),
        )
        expect(payload.architecture).toEqual(expect.any(Array))
    })
})
