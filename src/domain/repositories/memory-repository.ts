import type {
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    ObservationKind,
    SaveResult,
} from '../entities/memory'

export type MemorySearchInput = {
    query: string
    limit?: number
}

export type MemoryRecallInput = {
    task: string
    maxTokens?: number
    includeSources?: boolean
}

type SaveMemoryInput = {
    type: 'memory'
    content: string
    kind: ObservationKind
    importance?: 1 | 2 | 3 | 4 | 5
    source?: string
    tags?: string[]
}

type SaveDiaryInput = {
    type: 'diary'
    subject?: string
    summary: string
    tags?: string[]
}

type SaveSessionInput = {
    type: 'session'
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

type SaveBatchInput = {
    type: 'memories'
    memories: SaveMemoryInput[]
}

export type SaveInput =
    | SaveMemoryInput
    | SaveDiaryInput
    | SaveSessionInput
    | SaveBatchInput

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

export interface IMemoryRepository {
    search(input: MemorySearchInput): Promise<MemorySearchResult[]>
    save(input: SaveInput, options?: SaveOptions): Promise<SaveResult>
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
