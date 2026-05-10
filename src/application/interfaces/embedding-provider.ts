export interface IEmbeddingProvider {
    model: string
    dimensions: number
    embed(texts: string[]): Promise<Float32Array[]>
}
