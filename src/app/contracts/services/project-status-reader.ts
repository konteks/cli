import type { Project } from '@/app/models/project'

export type ProjectStatus = {
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

export interface ProjectStatusReaderContract {
    read(project: Project): Promise<ProjectStatus>
}
