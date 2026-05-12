import { projectDatabasePath } from '@/app/providers/database/sqlite/database'
import {
    loadProjectContext,
    pathExists,
} from '@/app/providers/file-system/context'
import { readMineManifest } from '@/app/providers/mining/engine/manifest'

const uninitializedCliMessage =
    'Konteks memory is not initialized. Run `konteks init`.'

export async function ensureCliProjectInitialized(
    project?: string,
): Promise<void> {
    const context = await loadProjectContext(project)

    if (!context.configExists) {
        throw new Error(uninitializedCliMessage)
    }

    if (!(await readMineManifest(context.memoryDir))) {
        throw new Error(uninitializedCliMessage)
    }

    if (!(await pathExists(projectDatabasePath(context)))) {
        throw new Error(uninitializedCliMessage)
    }
}
