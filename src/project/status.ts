import { pathExists, resolveProjectContext } from './context.js'

type ProjectStatus = {
    projectRoot: string
    memoryDir: string
    memoryDirExists: boolean
    configExists: boolean
    databasePath: string
    databaseExists: boolean
    freshness: {
        status: 'missing' | 'fresh' | 'stale' | 'unknown'
        reason: string
        recommendedCommand?: string
    }
}

export async function getProjectStatus(
    projectOverride?: string,
): Promise<ProjectStatus> {
    const context = await resolveProjectContext(projectOverride)
    const databasePath = `${context.memoryDir}/memory.sqlite`
    const memoryDirExists = await pathExists(context.memoryDir)
    const configExists = await pathExists(context.configPath)
    const databaseExists = await pathExists(databasePath)
    const missing = !memoryDirExists || !configExists || !databaseExists

    return {
        configExists,
        databaseExists,
        databasePath,
        freshness: missing
            ? {
                  reason: 'Konteks project memory is not initialized or no database exists.',
                  recommendedCommand: 'konteks init && konteks mine',
                  status: 'missing',
              }
            : {
                  reason: 'Freshness metadata is not implemented yet.',
                  recommendedCommand: 'konteks mine --changed',
                  status: 'unknown',
              },
        memoryDir: context.memoryDir,
        memoryDirExists,
        projectRoot: context.projectRoot,
    }
}
