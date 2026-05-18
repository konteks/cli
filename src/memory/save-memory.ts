import type {
    SaveDiaryInput,
    SaveMemoriesInput,
} from '@/contracts/repositories/memory-repository'
import type { SaveResult } from '@/models/memory'
import createMemoryRepository from './create-memory-repository'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from './runtime'

export async function saveMemories(
    input: SaveMemoriesInput,
): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await withProjectDatabaseContext(context, service =>
        createMemoryRepository(service, context).saveMemories(input, {
            projectUpdate,
        }),
    )
}

export async function saveDiary(input: SaveDiaryInput): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await withProjectDatabaseContext(context, service =>
        createMemoryRepository(service, context).saveDiary(input, {
            projectUpdate,
        }),
    )
}
