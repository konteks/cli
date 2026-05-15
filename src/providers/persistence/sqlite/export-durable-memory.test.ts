import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/providers/project/context'
import { openProjectDatabase } from './database'
import exportDurableMemory from './export-durable-memory'
import saveKonteksInput from './save-konteks-input'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('exportDurableMemory', () => {
    it('exports active rows and resolves payload-backed content', async () => {
        const { context, db } = await makeProject()
        context.config.storage.inlinePayloadMaxBytes = 8
        try {
            await saveKonteksInput(db, context, {
                content:
                    'Portable durable memory content should resolve from object storage.',
                kind: 'decision',
                type: 'memory',
            })
            await saveKonteksInput(db, context, {
                subject: 'portable export',
                summary: 'Diary export includes tags.',
                tags: ['export'],
                type: 'diary',
            })

            const payload = await exportDurableMemory(db, context, {
                includeInactive: false,
            })

            expect(payload.format).toBe('konteks.durable-memory.v1')
            expect(payload.memories[0]?.content).toContain(
                'Portable durable memory content',
            )
            expect(payload.diaries[0]).toMatchObject({
                subject: 'portable export',
                tags: ['export'],
            })
        } finally {
            await db.close()
        }
    })

    it('exports inactive rows only when requested', async () => {
        const { context, db } = await makeProject()
        try {
            const saved = await saveKonteksInput(db, context, {
                content: 'Inactive memory requires an explicit export flag.',
                kind: 'note',
                type: 'memory',
            })
            await db.adapter.execute(
                'update observations set suppressed_at = ?, forget_reason = ? where id = ?',
                [new Date().toISOString(), 'test inactive export', saved.id],
            )

            const activeOnly = await exportDurableMemory(db, context, {
                includeInactive: false,
            })
            const withInactive = await exportDurableMemory(db, context, {
                includeInactive: true,
            })

            expect(activeOnly.memories).toHaveLength(0)
            expect(withInactive.memories).toHaveLength(1)
            expect(withInactive.memories[0]?.suppressedAt).toBeString()
        } finally {
            await db.close()
        }
    })
})

async function makeProject() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-export-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    const context = await loadProjectContext(projectRoot)
    const db = await openProjectDatabase(context)
    return { context, db }
}
