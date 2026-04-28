import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '../project/context.js'
import { openProjectDatabase, projectDatabasePath } from './database.js'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('project database', () => {
    it('creates config and migrated database when opened directly', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-db-test-'))
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)

        const adapter = await openProjectDatabase(context)
        const migrations = await adapter.query<{ id: string }>(
            'select id from schema_migrations',
        )
        await adapter.close()

        expect(JSON.parse(await readFile(context.configPath, 'utf8'))).toEqual(
            context.config,
        )
        expect(projectDatabasePath(context)).toBe(
            join(projectRoot, '.konteks', 'memory.sqlite'),
        )
        expect(migrations).toEqual([
            { id: '001_initial_schema' },
            { id: '002_memory_hygiene' },
        ])
    })
})
