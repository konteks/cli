import type { SqliteConnection } from '@/database/actions/_db'
import { withActionDatabase } from '@/database/actions/_db'

export default async function withBoundActionDatabase<T>(
    connection: SqliteConnection,
    operation: () => Promise<T>,
): Promise<T> {
    return await withActionDatabase(connection.client, connection.db, operation)
}
