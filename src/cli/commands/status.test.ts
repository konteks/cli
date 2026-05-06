import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveKonteksInput } from '../../memory/save-store.js'
import { mineProject } from '../../mining/mine-project.js'
import { loadProjectContext } from '../../project/context.js'
import { openProjectDatabase } from '../../storage/database.js'
import { formatStatus, statusCommand } from './status.js'

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
            await statusCommand({ project: projectRoot })
            output = String(log.mock.calls[0]?.[0] ?? '')
        } finally {
            log.mockRestore()
        }

        expect(output).toContain('Konteks Ready')
        expect(output).toContain('Memory Stats')
        expect(output).toContain('Sections')
        expect(output).toContain('Memories')
        expect(output).toContain('Diary entries')
        expect(output).not.toContain('"freshness"')
    })

    it('supports colorized formatting for terminal output', () => {
        const output = formatStatus(
            {
                configExists: true,
                databaseExists: true,
                databasePath: '/tmp/project/.konteks/memory.sqlite',
                freshness: {
                    reason: 'Project extraction is current for 3 files.',
                    status: 'fresh',
                },
                memoryDir: '/tmp/project/.konteks',
                memoryDirExists: true,
                memoryStats: {
                    diaryEntries: 1,
                    embeddings: 3,
                    events: 4,
                    memories: 2,
                    modules: 1,
                    retrievalDocuments: 6,
                    sections: 3,
                },
                projectRoot: '/tmp/project',
            },
            {
                color: {
                    accent: value => `<accent>${value}</accent>`,
                    danger: value => `<danger>${value}</danger>`,
                    dim: value => `<dim>${value}</dim>`,
                    success: value => `<success>${value}</success>`,
                    warning: value => `<warning>${value}</warning>`,
                },
            },
        )

        expect(output).toContain('<accent>Konteks</accent>')
        expect(output).toContain('<success>Ready</success>')
        expect(output).toContain('<success>fresh</success>')
    })
})
