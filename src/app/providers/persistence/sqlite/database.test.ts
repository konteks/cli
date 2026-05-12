import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/app/providers/project/context'
import { mkdtemp, readFile, rm } from '@/app/support/file-manager'
import { openProjectDatabase, projectDatabasePath } from './database'

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
