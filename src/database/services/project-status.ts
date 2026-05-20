import { openProjectDatabase } from '@/database/actions/_db'
import queryProjectMemoryStats from '@/database/actions/query-project-memory-stats'
import withBoundActionDatabase from '@/database/actions/with-bound-action-database'
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
    const connection = await openProjectDatabase(context)
    try {
        return await withBoundActionDatabase(connection, () =>
            queryProjectMemoryStats(),
        )
    } finally {
        await connection.close()
    }
}
