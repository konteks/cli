import type {
    SaveDiaryInput,
    SaveMemoriesInput,
} from '@/database/services/save-memory'
import {
    saveKonteksDiary,
    saveKonteksMemories,
} from '@/database/services/save-memory'
import type { SaveResult } from '@/types/memory'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
} from './runtime'

export async function saveMemories(
    input: SaveMemoriesInput,
): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await saveKonteksMemories(context, input, { projectUpdate })
}

export async function saveDiary(input: SaveDiaryInput): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await saveKonteksDiary(context, input, { projectUpdate })
}
