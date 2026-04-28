type SqliteValue = boolean | number | string | null

export type SqliteParams = Record<string, SqliteValue> | SqliteValue[]

export type SqliteAdapter = {
    execute(sql: string, params?: SqliteParams): Promise<void>
    query<T extends Record<string, unknown>>(
        sql: string,
        params?: SqliteParams,
    ): Promise<T[]>
    transaction<T>(operation: () => Promise<T>): Promise<T>
}
