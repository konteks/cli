export type MemoryKind = 'session_diary' | 'durable_memory' | 'session_save'

export type MemoryEntity = {
    id: string
    type: string
    name: string
    canonicalName: string
    summary?: string
    properties?: Record<string, unknown>
}

export type MemoryRelation = {
    id: string
    subjectId: string
    predicate: string
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
    properties?: Record<string, unknown>
}

export type MemoryChunk = {
    id: string
    sourceId: string
    content: string
    contentHash: string
    metadata: Record<string, unknown>
}

export type MemorySearchResult = {
    id: string
    source: string
    score: number
    excerpt: string
    kind: MemoryKind
    metadata?: Record<string, unknown>
}
