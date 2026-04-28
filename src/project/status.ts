import { getMiningFreshness } from '../mining/manifest.js'
import { projectDatabasePath } from '../storage/database.js'
import { loadProjectContext, pathExists } from './context.js'

type ProjectStatus = {
    projectRoot: string
    memoryDir: string
    memoryDirExists: boolean
    configExists: boolean
    databasePath: string
    databaseExists: boolean
    freshness: {
        status: 'missing' | 'fresh' | 'stale'
        reason: string
        lastMinedAt?: string
        recommendedCommand?: string
    }
}

export async function getProjectStatus(
    projectOverride?: string,
): Promise<ProjectStatus> {
    const context = await loadProjectContext(projectOverride)
    const databasePath = projectDatabasePath(context)
    const memoryDirExists = await pathExists(context.memoryDir)
    const databaseExists = await pathExists(databasePath)
    const initialized = memoryDirExists && context.configExists

    return {
        configExists: context.configExists,
        databaseExists,
        databasePath,
        freshness: initialized
            ? await getMiningFreshness(context)
            : {
                  reason: 'Konteks project memory is not initialized.',
                  recommendedCommand: 'konteks init && konteks mine',
                  status: 'missing',
              },
        memoryDir: context.memoryDir,
        memoryDirExists,
        projectRoot: context.projectRoot,
    }
}
