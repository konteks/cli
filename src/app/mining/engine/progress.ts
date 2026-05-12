type MineProgressPhase =
    | 'chunks'
    | 'database'
    | 'done'
    | 'embeddings'
    | 'manifest'
    | 'metadata'
    | 'modules'
    | 'preparation'
    | 'scan'
    | 'select'
    | 'start'
    | 'summary'

type MineProgressStatus = 'done' | 'progress' | 'start'

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
    stage?: 'embed' | 'prepare'
    reusedCount?: number
    status: MineProgressStatus
    total?: number
}

export type MineProgressReporter = (event: MineProgressEvent) => void
