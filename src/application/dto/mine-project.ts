export type MineMode = 'reindex' | 'changed' | 'resume' | 'full'

export type MineProjectRequest = {
    projectRoot: string
    mode: MineMode
}

export type MineProjectResponse = {
    ok: boolean
    mode: MineMode
    projectRoot: string
    fileCount: number
    minedAt: string
    summaryRef: string
    chunkCount: number
    embeddedCount: number
    embeddingReusedCount: number
    technologies: string[]
    updatedFilePaths: string[]
    deletedFilePaths: string[]
}
