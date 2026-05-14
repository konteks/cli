type ExtractionProgressPhase =
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

type ExtractionProgressStatus = 'done' | 'progress' | 'start'

export type ExtractionProgressEvent = {
    chunkCount?: number
    current?: number
    downloadFile?: string
    downloadLoadedBytes?: number
    downloadPercent?: number
    downloadTotalBytes?: number
    embeddedCount?: number
    message?: string
    path?: string
    phase: ExtractionProgressPhase
    stage?: 'embed' | 'prepare'
    reusedCount?: number
    status: ExtractionProgressStatus
    total?: number
}

export type ExtractionProgressReporter = (
    event: ExtractionProgressEvent,
) => void
