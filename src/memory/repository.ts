import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { Project } from '@/models/project'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { SQLiteMemoryRepository } from '@/providers/persistence/sqlite/sqlite-memory-repository'

export function createMemoryRepository(
    service: DatabaseService,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
