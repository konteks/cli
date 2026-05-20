import type { Client, Transaction } from '@libsql/client'

export type SqliteExecutor = Pick<
    Client | Transaction,
    'execute' | 'executeMultiple'
>
