import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from '@/contracts/services/project-status-reader'
import type { Project } from '@/models/project'
import { getMiningFreshness } from '@/providers/extraction/engine/manifest'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '@/providers/persistence/sqlite/database'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { pathExists } from '@/providers/project/context'

export class ProjectStatusReader implements ProjectStatusReaderContract {
    async read(context: Project): Promise<ProjectStatus> {
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
}

function emptyMemoryStats(): ProjectStatus['memoryStats'] {
    return {
        diaryEntries: 0,
        embeddings: 0,
        events: 0,
        files: 0,
        memories: 0,
        modules: 0,
        retrievalDocuments: 0,
        sections: 0,
    }
}

async function readMemoryStats(
    context: Project,
): Promise<ProjectStatus['memoryStats']> {
    const service = await openProjectDatabase(context)
    try {
        const [
            files,
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
                "select count(*) as count from sources where type = 'mined_file'",
            ),
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
            files,
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
    service: DatabaseService,
    sql: string,
): Promise<number> {
    const rows = await service.adapter.query<{ count: number }>(sql)
    return rows[0]?.count ?? 0
}
