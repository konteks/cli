import type {
    ForgetInput,
    MemoryRepositoryContract,
} from '@/contracts/repositories/memory-repository'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { ForgetResult } from '@/models/memory'
import { createMemoryRepository } from './repository'
import { loadMcpProjectContext, withProjectDatabaseContext } from './runtime'

export async function forgetMemory(
    options: StartMcpServerOptions,
    input: ForgetInput,
): Promise<ForgetResult> {
    const context = await loadMcpProjectContext(options)
    return await withProjectDatabaseContext(context, service =>
        forgetRepositoryMemory(createMemoryRepository(service, context), input),
    )
}

async function forgetRepositoryMemory(
    memoryRepository: MemoryRepositoryContract,
    input: ForgetInput,
): Promise<ForgetResult> {
    return await memoryRepository.forget(input)
}
