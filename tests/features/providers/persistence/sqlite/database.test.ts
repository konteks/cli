import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '@/providers/persistence/sqlite/database'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

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

describe('project database', () => {
    it('creates config and migrated database when opened directly', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-db-test-'))
        tempDirs.push(projectRoot)
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const service = await openProjectDatabase(context)
        const migrations = await service.adapter.query<{ id: string }>(
            'select id from schema_migrations',
        )
        await service.close()

        expect(JSON.parse(await readFile(context.configPath, 'utf8'))).toEqual(
            context.config,
        )
        expect(projectDatabasePath(context)).toBe(
            join(projectRoot, '.konteks', 'memory.sqlite'),
        )
        expect(migrations).toEqual([{ id: '001_initial_schema' }])
    })
})
