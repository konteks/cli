import {
    ensureProjectDatabase,
    projectDatabasePath,
} from '@/database/actions/_db'
import type { Project } from '@/models/project'

export function projectMemoryDatabasePath(context: Project): string {
    return projectDatabasePath(context)
}

export async function ensureProjectMemory(context: Project): Promise<void> {
    await ensureProjectDatabase(context)
}
