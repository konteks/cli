import type {
    Client,
    InArgs,
    ResultSet,
    Row,
    Transaction,
} from '@libsql/client'
export type SqliteParams = InArgs

export type SqliteExecutor = Pick<
    Client | Transaction,
    'execute' | 'executeMultiple'
>

export async function executeSql(
    client: SqliteExecutor,
    sql: string,
    args?: SqliteParams,
): Promise<ResultSet> {
    return args === undefined
        ? client.execute(sql)
        : client.execute({ args, sql })
}

export async function querySql<T extends Record<string, unknown>>(
    client: SqliteExecutor,
    sql: string,
    args?: SqliteParams,
): Promise<T[]> {
    const result = await executeSql(client, sql, args)
    return result.rows.map(row => rowToRecord(row) as T)
}

function rowToRecord(row: Row): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(row).filter(([key]) => Number.isNaN(Number(key))),
    )
}
