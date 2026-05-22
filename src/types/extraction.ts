export type ExtractionMode = 'rebuild' | 'changed' | 'resume' | 'full'
export type LegacyExtractionMode = 'reindex'

export type ExtractProjectRequest = {
    projectRoot: string
    mode: ExtractionMode
}

export type ExtractProjectResponse = {
    ok: boolean
    mode: ExtractionMode
    projectRoot: string
    fileCount: number
    extractedAt: string
    summaryRef: string
    sectionCount: number
    detectedParserLanguages: string[]
    embeddedCount: number
    embeddingReusedCount: number
    technologies: string[]
    languageCount: number
    loadedParserCount: number
    vectorCount: number
    updatedFilePaths: string[]
    deletedFilePaths: string[]
}
