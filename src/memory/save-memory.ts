import type {
    SaveDiaryInput,
    SaveMemoriesInput,
} from '@/contracts/repositories/memory-repository'
import { withMemoryRepository } from '@/database/services/memory-repository'
import type { SaveResult } from '@/models/memory'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
} from './runtime'

export async function saveMemories(
    input: SaveMemoriesInput,
): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await withMemoryRepository(context, repository =>
        repository.saveMemories(input, {
            projectUpdate,
        }),
    )
}

export async function saveDiary(input: SaveDiaryInput): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await withMemoryRepository(context, repository =>
        repository.saveDiary(input, {
            projectUpdate,
        }),
    )
}
