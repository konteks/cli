import type {
    MemoryRepositoryContract,
    MemorySearchInput,
} from '@/contracts/repositories/memory-repository'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { MemorySearchResult } from '@/models/memory'
import createMemoryRepository from './create-memory-repository'
import { loadMcpProjectContext, withProjectDatabaseContext } from './runtime'

export default async function searchMemory(
    options: StartMcpServerOptions,
    input: MemorySearchInput,
): Promise<MemorySearchResult[]> {
    const context = await loadMcpProjectContext(options)
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
