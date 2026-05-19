// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import exportDurableMemory from '@/providers/persistence/sqlite/export-durable-memory'
import { executeSql } from '@/providers/persistence/sqlite/libsql-helpers'
import {
    saveKonteksDiary,
    saveKonteksMemory,
} from '@/providers/persistence/sqlite/save-konteks-input'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function withProjectRoot<T>(
    projectRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(projectRoot)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

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
            await saveKonteksMemory(db, context, {
                content:
                    'Portable durable memory content should resolve from object storage.',
                importance: 3,
                kind: 'decision',
            })
            await saveKonteksDiary(db, context, {
                subject: 'portable export',
                summary: 'Diary export includes tags.',
                tags: ['export'],
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
            const saved = await saveKonteksMemory(db, context, {
                content: 'Inactive memory requires an explicit export flag.',
                importance: 3,
                kind: 'note',
            })
            await executeSql(
                db.client,
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
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const db = await openProjectDatabase(context)
    return { context, db }
}
