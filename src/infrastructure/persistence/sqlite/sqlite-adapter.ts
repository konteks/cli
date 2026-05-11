import type { SqliteRemoteDatabase } from '@/services/database'
import type * as schema from './schema'

type SqliteValue = Uint8Array | boolean | number | string | null

export type SqliteParams = Record<string, SqliteValue> | SqliteValue[]

export type SqliteAdapter = {
    close(): Promise<void>
    execute(sql: string, params?: SqliteParams): Promise<void>
    query<T extends Record<string, unknown>>(
        sql: string,
        params?: SqliteParams,
    ): Promise<T[]>
    queryArrays(sql: string, params?: SqliteParams): Promise<unknown[][]>
    transaction<T>(operation: () => Promise<T>): Promise<T>
}

export type KonteksDatabase = SqliteRemoteDatabase<typeof schema>
