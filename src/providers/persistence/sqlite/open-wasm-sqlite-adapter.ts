import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import sqlite3InitModule, {
    type BindingSpec,
    type Database,
    type Sqlite3Static,
} from '@sqlite.org/sqlite-wasm'
import { pathExists } from '@/providers/project/context'
import type { SqliteAdapter, SqliteParams } from './sqlite-adapter'

let sqliteInitPromise: Promise<Sqlite3Static> | undefined

export default async function openWasmSqliteAdapter(
    databasePath: string,
): Promise<SqliteAdapter> {
    const sqlite3 = await loadSqlite()
    const db = new sqlite3.oo1.DB(':memory:', 'cw')
    const adapter = new WasmSqliteAdapter(sqlite3, db, databasePath)
    await adapter.load()
    return adapter
}

async function loadSqlite(): Promise<Sqlite3Static> {
    sqliteInitPromise ??= sqlite3InitModule()
    return sqliteInitPromise
}

class WasmSqliteAdapter implements SqliteAdapter {
    private transactionDepth = 0
    private closed = false

    public constructor(
        private readonly sqlite3: Sqlite3Static,
        private readonly db: Database,
        private readonly databasePath: string,
    ) {}

    public async load(): Promise<void> {
        await mkdir(dirname(this.databasePath), { recursive: true })

        if (!(await pathExists(this.databasePath))) {
            await this.flush()
            return
        }

        const fileBytes = await readFile(this.databasePath)
        if (fileBytes.byteLength === 0) {
            await this.flush()
            return
        }
        const bytes = new Uint8Array(fileBytes)

        const pointer = this.db.pointer
        if (!pointer) {
            throw new Error('SQLite database is closed.')
        }

        const dataPointer = this.sqlite3.wasm.allocFromTypedArray(bytes)
        const result = this.sqlite3.capi.sqlite3_deserialize(
            pointer,
            'main',
            dataPointer,
            bytes.byteLength,
            bytes.byteLength,
            this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
                this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
        )

        if (result !== this.sqlite3.capi.SQLITE_OK) {
            throw new Error(`Failed to deserialize SQLite database: ${result}`)
        }
    }

    public async close(): Promise<void> {
        if (this.closed) {
            return
        }

        await this.flush()
        this.db.close()
        this.closed = true
    }

    public async execute(sql: string, params?: SqliteParams): Promise<void> {
        this.assertOpen()
        this.db.exec({ bind: toBindingSpec(params), sql })
        await this.flushUnlessInTransaction()
    }

    public async query<T extends Record<string, unknown>>(
        sql: string,
        params?: SqliteParams,
    ): Promise<T[]> {
        this.assertOpen()
        return this.db.selectObjects(sql, toBindingSpec(params)) as T[]
    }

    public async queryArrays(sql: string, params?: SqliteParams) {
        this.assertOpen()
        return this.db.selectArrays(sql, toBindingSpec(params))
    }

    public async transaction<T>(operation: () => Promise<T>): Promise<T> {
        this.assertOpen()

        if (this.transactionDepth > 0) {
            return operation()
        }

        this.transactionDepth += 1
        this.db.exec('begin immediate')

        try {
            const result = await operation()
            this.db.exec('commit')
            await this.flush()
            return result
        } catch (error) {
            this.db.exec('rollback')
            throw error
        } finally {
            this.transactionDepth -= 1
        }
    }

    private async flushUnlessInTransaction(): Promise<void> {
        if (this.transactionDepth === 0) {
            await this.flush()
        }
    }

    private async flush(): Promise<void> {
        const pointer = this.db.pointer
        if (!pointer) {
            return
        }

        const bytes = this.sqlite3.capi.sqlite3_js_db_export(pointer)
        const tempPath = `${this.databasePath}.${process.pid}.${randomUUID()}.tmp`
        await writeFile(tempPath, bytes)
        await rename(tempPath, this.databasePath)
    }

    private assertOpen(): void {
        if (this.closed || !this.db.pointer) {
            throw new Error('SQLite database is closed.')
        }
    }
}

function toBindingSpec(params?: SqliteParams): BindingSpec | undefined {
    if (!params) {
        return undefined
    }

    return params
}
