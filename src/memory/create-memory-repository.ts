import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { SqliteConnection } from '@/database/actions/_db'
import SQLiteMemoryRepository from '@/database/repositories/sqlite-memory-repository'
import type { Project } from '@/models/project'

export default function createMemoryRepository(
    service: SqliteConnection,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
