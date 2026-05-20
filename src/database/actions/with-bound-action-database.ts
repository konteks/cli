import type { SqliteConnection } from '@/database/actions/_db'
import actionDb from '@/database/actions/_db'

export default async function withBoundActionDatabase<T>(
    connection: SqliteConnection,
    operation: () => Promise<T>,
): Promise<T> {
    return await actionDb.withActionDatabase(
        connection.client,
        connection.db,
        operation,
    )
}
