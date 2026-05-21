import { openProjectDatabase } from '@/database/actions/_db'
import type {
    SaveDiaryInput,
    SaveMemoriesInput,
} from '@/database/services/save-memory'
import {
    saveKonteksDiary,
    saveKonteksMemories,
} from '@/database/services/save-memory'
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
    const db = await openProjectDatabase(context)
    try {
        return await saveKonteksMemories(db, context, input, {
            projectUpdate,
        })
    } finally {
        await db.close()
    }
}

export async function saveDiary(input: SaveDiaryInput): Promise<SaveResult> {
    const context = await loadMcpProjectContext()
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const db = await openProjectDatabase(context)
    try {
        return await saveKonteksDiary(db, context, input, {
            projectUpdate,
        })
    } finally {
        await db.close()
    }
}
