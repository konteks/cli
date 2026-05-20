import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { Project } from '@/models/project'
import type { SqliteConnection } from '@/providers/persistence/sqlite/database'
import SQLiteMemoryRepository from '@/providers/persistence/sqlite/sqlite-memory-repository'

export default function createMemoryRepository(
    service: SqliteConnection,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
