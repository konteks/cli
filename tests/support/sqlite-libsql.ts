import type { Client, InArgs, Transaction } from '@libsql/client'

type SqliteExecutor = Pick<Client | Transaction, 'execute'>

export async function executeSql(
    client: SqliteExecutor,
    sql: string,
    args: InArgs = [],
): Promise<void> {
    await client.execute({ args, sql })
}

export async function querySql<Row extends Record<string, unknown>>(
    client: SqliteExecutor,
    sql: string,
    args: InArgs = [],
): Promise<Row[]> {
    const result = await client.execute({ args, sql })
    return result.rows as unknown as Row[]
}
