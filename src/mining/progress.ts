export type MineProgressPhase =
    | 'chunks'
    | 'database'
    | 'done'
    | 'embeddings'
    | 'manifest'
    | 'metadata'
    | 'modules'
    | 'scan'
    | 'select'
    | 'start'
    | 'summary'

export type MineProgressStatus = 'done' | 'progress' | 'start'

export type MineProgressEvent = {
    chunkCount?: number
    current?: number
    downloadFile?: string
    downloadLoadedBytes?: number
    downloadPercent?: number
    downloadTotalBytes?: number
    embeddedCount?: number
    message?: string
    path?: string
    phase: MineProgressPhase
    reusedCount?: number
    status: MineProgressStatus
    total?: number
}

export type MineProgressReporter = (event: MineProgressEvent) => void
