import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import { openProjectDatabase } from '@/database/actions/_db'
import SQLiteMemoryRepository from '@/database/repositories/sqlite-memory-repository'
import type { Project } from '@/models/project'

export async function withMemoryRepository<T>(
    context: Project,
    operation: (repository: MemoryRepositoryContract) => Promise<T>,
): Promise<T> {
    const connection = await openProjectDatabase(context)
    try {
        return await operation(new SQLiteMemoryRepository(connection, context))
    } finally {
        await connection.close()
    }
}
