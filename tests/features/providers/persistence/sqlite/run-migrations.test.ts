import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import DatabaseService from '@/providers/persistence/sqlite/database-service'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
import runMigrations from '@/providers/persistence/sqlite/run-migrations'
import * as schema from '@/providers/persistence/sqlite/schema'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('migrations', () => {
    it('runs unapplied migrations through a LibSQL service', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'konteks-migration-'))
        tempDirs.push(tempDir)
        const client = createClient({ url: `file:${join(tempDir, 'test.db')}` })
        const service = new DatabaseService(client, drizzle(client, { schema }))

        await runMigrations(service)
        const migrations = await querySql<{ id: string }>(
            service.client,
            'select id from schema_migrations',
        )
        const tables = await querySql<{ name: string }>(
            service.client,
            `
select name
from sqlite_master
where type = 'table'
  and name = 'memory_events'
`,
        )
        await service.close()

        expect(migrations).toEqual([{ id: '001_initial_schema' }])
        expect(tables).toEqual([{ name: 'memory_events' }])
    })
})
