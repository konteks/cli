import type {
    MemoryRepositoryContract,
    SaveInput,
    SaveOptions,
} from '@/contracts/repositories/memory-repository'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { SaveResult } from '@/models/memory'
import createMemoryRepository from './create-memory-repository'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from './runtime'

export default async function saveMemory(
    options: StartMcpServerOptions,
    input: SaveInput,
): Promise<SaveResult> {
    const context = await loadMcpProjectContext(options)
    const projectUpdate = await updateChangedProjectMemorySilently(
        context,
        options,
    )
    return await withProjectDatabaseContext(context, service =>
        saveRepositoryMemory(createMemoryRepository(service, context), input, {
            projectUpdate,
        }),
    )
}

async function saveRepositoryMemory(
    memoryRepository: MemoryRepositoryContract,
    input: SaveInput,
    options?: SaveOptions,
): Promise<SaveResult> {
    return await memoryRepository.save(input, options)
}
