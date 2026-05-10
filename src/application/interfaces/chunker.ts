export type ChunkBody = {
    anchor: string
    anchorType: string
    content: string
    kind: string
    path: string
    summary: string
    symbol?: string
    startLine?: number
    endLine?: number
    metadata?: Record<string, unknown>
}

export interface IChunker {
    chunkFile(path: string, content: string): Promise<ChunkBody[]>
}
