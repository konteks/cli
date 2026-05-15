import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { Project } from '@/models/project'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import SQLiteMemoryRepository from '@/providers/persistence/sqlite/sqlite-memory-repository'

export default function createMemoryRepository(
    service: DatabaseService,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
