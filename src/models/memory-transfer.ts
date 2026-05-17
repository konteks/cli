import type { ObservationKind } from './memory'

export type DurableMemoryExport = {
    exportedAt: string
    format: 'konteks.durable-memory.v1'
    project: {
        name?: string
        root: string
    }
    memories: DurableMemoryExportMemory[]
    diaries: DurableMemoryExportDiary[]
}

export type DurableMemoryExportMemory = {
    confidence: number
    content: string
    contentHash: string
    createdAt: string
    deletedAt?: string
    forgetReason?: string
    id: string
    kind: ObservationKind
    suppressedAt?: string
}

export type DurableMemoryExportDiary = {
    contentHash: string
    createdAt: string
    deletedAt?: string
    forgetReason?: string
    id: string
    subject?: string
    summary: string
    suppressedAt?: string
    tags: string[]
}

export type DurableMemoryExportOptions = {
    includeInactive?: boolean
    outputPath: string
}

export type DurableMemoryImportOptions = {
    dryRun?: boolean
    inputPath: string
}

export type DurableMemoryExportResult = {
    diaries: number
    memories: number
    outputPath: string
}

export type DurableMemoryImportResult = {
    diariesImported: number
    diariesSkipped: number
    dryRun: boolean
    memoriesImported: number
    memoriesSkipped: number
}

export type MemoryRestoreOptions = {
    force?: boolean
    inputPath: string
}

export type MemoryRestoreResult = {
    inputPath: string
    memoryDir: string
    safetyBackupPath?: string
}
