import type {
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
} from '../entities/memory.js'

export type SaveMemoryInput = {
    content: string
    kind: string
    importance?: 1 | 2 | 3 | 4 | 5
    source?: string
    entities?: string[]
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

export type SaveResult = {
    id: string
    accepted: boolean
    duplicateOf?: string
}

export interface IMemoryRepository {
    search(query: string, limit?: number): Promise<MemorySearchResult[]>
    saveMemory(input: SaveMemoryInput): Promise<SaveResult>
    saveDiary(input: SaveDiaryInput): Promise<SaveResult>
    saveSession(input: SaveSessionInput): Promise<SaveResult>

    upsertEntity(
        entity: Partial<MemoryEntity> & { name: string; type: string },
    ): Promise<MemoryEntity>
    addRelation(
        relation: Omit<MemoryRelation, 'id' | 'status'>,
    ): Promise<MemoryRelation>
    findEntityByCanonicalName(name: string): Promise<MemoryEntity | undefined>
}
