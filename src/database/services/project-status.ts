import { withTransaction } from '@/database/actions/_db'
import queryProjectMemoryStats from '@/database/actions/query-project-memory-stats'
import type { Project } from '@/models/project'

export type ProjectMemoryStats = {
    files: number
    sections: number
    modules: number
    memories: number
    diaryEntries: number
    retrievalDocuments: number
    embeddings: number
    events: number
}

export async function readProjectMemoryStats(
    context: Project,
): Promise<ProjectMemoryStats> {
    void context
    return await withTransaction(() => queryProjectMemoryStats())
}
