import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openWasmSqliteAdapter } from './wasm-sqlite-adapter'

const tempDirs: string[] = []

async function makeTempDatabasePath(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'konteks-sqlite-test-'))
    tempDirs.push(directory)
    return join(directory, 'memory.sqlite')
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('WASM SQLite adapter', () => {
    it('executes queries and persists the database to disk', async () => {
        const databasePath = await makeTempDatabasePath()
        const adapter = await openWasmSqliteAdapter(databasePath)

        await adapter.execute(
            'create table items (id text primary key, value text)',
        )
        await adapter.execute('insert into items (id, value) values (?, ?)', [
            'one',
            'first',
        ])
        expect(
            await adapter.query<{ value: string }>(
                'select value from items where id = ?',
                ['one'],
            ),
        ).toEqual([{ value: 'first' }])
        await adapter.close()

        const reopened = await openWasmSqliteAdapter(databasePath)
        expect(
            await reopened.query<{ value: string }>(
                'select value from items where id = ?',
                ['one'],
            ),
        ).toEqual([{ value: 'first' }])
        await reopened.close()
    })

    it('rolls back failed transactions', async () => {
        const databasePath = await makeTempDatabasePath()
        const adapter = await openWasmSqliteAdapter(databasePath)

        await adapter.execute('create table items (id text primary key)')
        await expect(
            adapter.transaction(async () => {
                await adapter.execute('insert into items (id) values (?)', [
                    'one',
                ])
                throw new Error('stop')
            }),
        ).rejects.toThrow('stop')

        expect(await adapter.query('select id from items')).toEqual([])
        await adapter.close()
    })
})
