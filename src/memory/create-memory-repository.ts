import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { SqliteConnection } from '@/database/actions/_db'
import type { Project } from '@/models/project'
import SQLiteMemoryRepository from '@/providers/persistence/sqlite/sqlite-memory-repository'

export default function createMemoryRepository(
    service: SqliteConnection,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
