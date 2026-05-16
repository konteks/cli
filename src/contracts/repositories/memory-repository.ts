import type {
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    ObservationKind,
    SaveResult,
} from '@/models/memory'

export type MemorySearchInput = {
    query: string
    limit?: number
}

export type MemoryRecallInput = {
    task: string
    maxTokens?: number
    includeSources?: boolean
}

export type SaveMemoryInput = {
    content: string
    kind: ObservationKind
    importance: 1 | 2 | 3 | 4 | 5
    source?: string
    tags?: string[]
}

export type SaveDiaryInput = {
    subject?: string
    summary: string
    tags?: string[]
}

export type SaveSessionInput = {
    task: string
    summary: string
    status: 'blocked' | 'done' | 'partial'
    blockers?: string[]
    decisions?: string[]
    entities?: string[]
    filesTouched?: string[]
    nextSteps?: string[]
    openQuestions?: string[]
    testsRun?: string[]
}

export type SaveMemoriesInput = {
    memories: SaveMemoryInput[]
}

export type ForgetInput = {
    id?: string
    query?: string
    mode?: 'hard_delete' | 'invalidate' | 'soft_delete'
    reason?: string
}

export type SaveOptions = {
    projectUpdate?: {
        deletedFilePaths: string[]
        updatedFilePaths: string[]
    }
}

export interface MemoryRepositoryContract {
    search(input: MemorySearchInput): Promise<MemorySearchResult[]>
    saveMemory(
        input: SaveMemoryInput,
        options?: SaveOptions,
    ): Promise<SaveResult>
    saveMemories(
        input: SaveMemoriesInput,
        options?: SaveOptions,
    ): Promise<SaveResult>
    saveDiary(input: SaveDiaryInput, options?: SaveOptions): Promise<SaveResult>
    saveSession(
        input: SaveSessionInput,
        options?: SaveOptions,
    ): Promise<SaveResult>
    forget(input: ForgetInput): Promise<ForgetResult>

    // Graph operations
    upsertEntity(
        entity: Partial<MemoryEntity> & { name: string; type: string },
    ): Promise<MemoryEntity>
    addRelation(
        relation: Omit<MemoryRelation, 'id' | 'status'>,
    ): Promise<MemoryRelation>
    findEntityByCanonicalName(name: string): Promise<MemoryEntity | undefined>
    searchEntities(query: string, limit?: number): Promise<MemoryEntity[]>
    traverseNeighbors(
        entityId: string,
        options?: { maxDepth?: number; limit?: number },
    ): Promise<GraphNeighbor[]>
    historicalRelations(
        entityId: string,
        limit?: number,
    ): Promise<HistoricalRelation[]>
}
