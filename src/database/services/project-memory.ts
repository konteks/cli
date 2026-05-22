import getDb, { projectDatabasePath } from '@/database/actions/_db'
import type { Project } from '@/types/project'

export function projectMemoryDatabasePath(context: Project): string {
    return projectDatabasePath(context)
}

export async function ensureProjectMemory(): Promise<void> {
    await getDb()
}
