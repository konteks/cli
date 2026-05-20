// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/database/actions/_db'
import type { DurableMemoryExport } from '@/models/memory-transfer'
import { contentHash } from '@/providers/persistence/objects/content'
import importDurableMemory from '@/providers/persistence/sqlite/import-durable-memory'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
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

describe('importDurableMemory', () => {
    it('supports dry runs, imports rows, skips duplicates, and appends an event', async () => {
        const { context, db } = await makeProject()
        const payload = durableMemoryPayload()
        try {
            const dryRun = await importDurableMemory(db, context, payload, {
                dryRun: true,
            })
            const afterDryRun = await querySql<{ count: number }>(
                db.client,
                'select count(*) as count from observations',
            )

            const imported = await importDurableMemory(db, context, payload, {})
            const duplicate = await importDurableMemory(
                db,
                context,
                payload,
                {},
            )
            const events = await querySql<{ event_type: string }>(
                db.client,
                "select event_type from memory_events where event_type = 'memory_imported'",
            )

            expect(dryRun).toMatchObject({
                diariesImported: 1,
                dryRun: true,
                memoriesImported: 1,
            })
            expect(afterDryRun[0]?.count).toBe(0)
            expect(imported).toMatchObject({
                diariesImported: 1,
                memoriesImported: 1,
            })
            expect(duplicate).toMatchObject({
                diariesSkipped: 1,
                memoriesSkipped: 1,
            })
            expect(events).toHaveLength(2)
        } finally {
            await db.close()
        }
    })
})

function durableMemoryPayload(): DurableMemoryExport {
    const memoryContent = 'Imported durable memory should be searchable.'
    const diarySummary = 'Imported diary should be persisted.'
    const diaryTags = ['import']
    return {
        diaries: [
            {
                contentHash: contentHash(
                    ['import diary', diarySummary, diaryTags.join(', ')].join(
                        '\n',
                    ),
                ),
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'diary_exported',
                subject: 'import diary',
                summary: diarySummary,
                tags: diaryTags,
            },
        ],
        exportedAt: '2026-01-01T00:00:00.000Z',
        format: 'konteks.durable-memory.v1',
        memories: [
            {
                confidence: 0.8,
                content: memoryContent,
                contentHash: contentHash(memoryContent),
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'obs_exported',
                kind: 'code_insight',
            },
        ],
        project: {
            root: '/source/project',
        },
    }
}

async function makeProject() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-import-test-'))
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
