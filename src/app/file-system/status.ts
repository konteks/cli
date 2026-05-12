import {
    openProjectDatabase,
    projectDatabasePath,
} from '@/app/database/sqlite/database'
import { getMiningFreshness } from '@/app/mining/engine/manifest'
import { loadProjectContext, pathExists } from './context'

type ProjectStatus = {
    projectRoot: string
    memoryDir: string
    memoryDirExists: boolean
    configExists: boolean
    databasePath: string
    databaseExists: boolean
    memoryStats: {
        sections: number
        modules: number
        memories: number
        diaryEntries: number
        retrievalDocuments: number
        embeddings: number
        events: number
    }
    freshness: {
        status: 'missing' | 'fresh' | 'stale'
        reason: string
        changedFileCount: number
        lastExtractedAt?: string
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
                  changedFileCount: 0,
                  reason: 'Konteks project memory is not initialized.',
                  recommendedCommand: 'konteks init',
                  status: 'missing',
              },
        memoryDir: context.memoryDir,
        memoryDirExists,
        memoryStats: databaseExists
            ? await readMemoryStats(context)
            : emptyMemoryStats(),
        projectRoot: context.projectRoot,
    }
}

function emptyMemoryStats(): ProjectStatus['memoryStats'] {
    return {
        diaryEntries: 0,
        embeddings: 0,
        events: 0,
        memories: 0,
        modules: 0,
        retrievalDocuments: 0,
        sections: 0,
    }
}

async function readMemoryStats(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
): Promise<ProjectStatus['memoryStats']> {
    const service = await openProjectDatabase(context)
    try {
        const [
            sections,
            modules,
            memories,
            diaryEntries,
            retrievalDocuments,
            embeddings,
            events,
        ] = await Promise.all([
            countRows(
                service,
                'select count(*) as count from chunks where deleted_at is null and suppressed_at is null',
            ),
            countRows(service, 'select count(*) as count from modules'),
            countRows(
                service,
                'select count(*) as count from observations where deleted_at is null and suppressed_at is null',
            ),
            countRows(
                service,
                'select count(*) as count from diary_entries where deleted_at is null and suppressed_at is null',
            ),
            countRows(
                service,
                'select count(*) as count from retrieval_documents',
            ),
            countRows(
                service,
                'select count(*) as count from target_embeddings',
            ),
            countRows(service, 'select count(*) as count from memory_events'),
        ])

        return {
            diaryEntries,
            embeddings,
            events,
            memories,
            modules,
            retrievalDocuments,
            sections,
        }
    } finally {
        await service.close()
    }
}

async function countRows(
    service: Awaited<ReturnType<typeof openProjectDatabase>>,
    sql: string,
): Promise<number> {
    const rows = await service.adapter.query<{ count: number }>(sql)
    return rows[0]?.count ?? 0
}
