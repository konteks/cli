import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mineProject } from '@/providers/extraction/mine-project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import { saveKonteksInput } from '@/providers/persistence/sqlite/save-store'
import { loadProjectContext } from '@/providers/project/context'
import { VERSION } from '@/support/version'
import { getStatusCommand } from './get-status'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('status command', () => {
    it('prints human-readable memory stats', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'status-fixture' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const statusFixture = true\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')
        const adapter = await openProjectDatabase(context)
        await saveKonteksInput(adapter, context, {
            content: 'Status command should include saved memory counts.',
            kind: 'fact',
            type: 'memory',
        })
        await saveKonteksInput(adapter, context, {
            summary: 'Status command fixture diary entry.',
            type: 'diary',
        })
        await adapter.close()

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''
        try {
            await getStatusCommand({ project: projectRoot })
            output = String(log.mock.calls[0]?.[0] ?? '')
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('Konteks Memory')
        expect(output).toContain(`v${VERSION}`)
        expect(output).toContain('Freshness')
        expect(output).toContain('no file changes')
        expect(output).toContain('Knowledge')
        expect(output).toContain('Session Memory')
        expect(output).toContain('Retrieval')
        expect(output).toContain('sections')
        expect(output).toContain('memories')
        expect(output).toContain('diary entries')
        expect(output).toContain('documents')
        expect(output).toContain('vectors')
        expect(output).not.toContain('Events')
        expect(output).not.toContain('Retrieval docs')
        expect(output).not.toContain('Embeddings')
        expect(output).not.toContain('Needs Attention')
        expect(output).not.toContain('Config')
        expect(output).not.toContain('Database')
        expect(output).not.toContain('State')
        expect(output).not.toContain('Reason')
        expect(output).not.toContain('Next step')
        expect(output).not.toContain('"freshness"')
    })

    it('shows changed file count since the last extraction', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'status-fixture' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const statusFixture = true\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const statusFixture = false\n',
        )
        await writeFile(
            join(projectRoot, 'src', 'new-feature.ts'),
            'export const newFeature = true\n',
        )

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''
        try {
            await getStatusCommand({ project: projectRoot })
            output = String(log.mock.calls[0]?.[0] ?? '')
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('Freshness')
        expect(output).toContain('2 files changed; indexed during warm up/save')
    })

    it('suggests init when project memory is not initialized', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
        tempDirs.push(projectRoot)

        const log = spyOn(console, 'log').mockImplementation(() => {})
        let output = ''
        try {
            await getStatusCommand({ project: projectRoot })
            output = String(log.mock.calls[0]?.[0] ?? '')
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('Freshness')
        expect(output).toContain('Konteks project memory is not initialized.')
        expect(output).toContain('run konteks init')
    })
})
