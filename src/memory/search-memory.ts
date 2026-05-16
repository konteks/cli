import type {
    MemoryRepositoryContract,
    MemorySearchInput,
} from '@/contracts/repositories/memory-repository'
import type { MemorySearchResult } from '@/models/memory'
import createMemoryRepository from './create-memory-repository'
import { loadMcpProjectContext, withProjectDatabaseContext } from './runtime'

export default async function searchMemory(
    input: MemorySearchInput,
): Promise<MemorySearchResult[]> {
    const context = await loadMcpProjectContext()
    return await withProjectDatabaseContext(context, service =>
        searchRepositoryMemory(createMemoryRepository(service, context), input),
    )
}

async function searchRepositoryMemory(
    memoryRepository: MemoryRepositoryContract,
    input: MemorySearchInput,
): Promise<MemorySearchResult[]> {
    return await memoryRepository.search(input)
}
