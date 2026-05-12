export interface EmbeddingProviderContract {
    model: string
    dimensions: number
    embed(texts: string[]): Promise<Float32Array[]>
    prepare?(): Promise<void>
}
