import { Database } from 'bun:sqlite'
import { projectDatabasePath } from '@/database/actions/_db'
import type { Project } from '@/models/project'

type SqliteQueryTarget = Project | string
type SqliteValue = Uint8Array | boolean | number | string | null

function resolveDatabasePath(target: SqliteQueryTarget): string {
    return typeof target === 'string' ? target : projectDatabasePath(target)
}

export async function querySql<Row extends Record<string, unknown>>(
    target: SqliteQueryTarget,
    sql: string,
    args: SqliteValue[] = [],
): Promise<Row[]> {
    const database = new Database(resolveDatabasePath(target), {
        readonly: true,
        strict: true,
    })

    try {
        return database.query(sql).all(...args) as Row[]
    } finally {
        database.close()
    }
}
