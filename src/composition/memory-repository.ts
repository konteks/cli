import type { MemoryRepositoryContract } from '@/app/contracts/repositories/memory-repository'
import type { Project } from '@/app/models/project'
import type { DatabaseService } from '@/app/providers/persistence/sqlite/db'
import { SQLiteMemoryRepository } from '@/app/providers/persistence/sqlite/sqlite-memory-repository'

export function createMemoryRepository(
    service: DatabaseService,
    context: Project,
): MemoryRepositoryContract {
    return new SQLiteMemoryRepository(service, context)
}
