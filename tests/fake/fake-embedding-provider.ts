import type { EmbeddingProviderContract } from '@/types/embedding-provider'

export default class FakeEmbeddingProvider
    implements EmbeddingProviderContract
{
    public readonly model = 'fake/all-MiniLM-L6-v2'
    public readonly dimensions: number

    public constructor(dimensions = 8) {
        this.dimensions = dimensions
    }

    public async embed(texts: string[]): Promise<Float32Array[]> {
        return texts.map(text => deterministicVector(text, this.dimensions))
    }
}

function deterministicVector(text: string, dimensions: number): Float32Array {
    const vector = new Float32Array(dimensions)
    let hash = 2166136261
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    for (let index = 0; index < dimensions; index += 1) {
        hash ^= index + 1
        hash = Math.imul(hash, 16777619)
        const normalized = (hash >>> 0) / 0xffffffff
        vector[index] = normalized * 2 - 1
    }
    return normalizeVector(vector)
}

function normalizeVector(vector: Float32Array): Float32Array {
    let normSquared = 0
    for (const value of vector) {
        normSquared += value * value
    }

    if (normSquared === 0) {
        return vector
    }

    const norm = Math.sqrt(normSquared)
    for (let index = 0; index < vector.length; index += 1) {
        vector[index] /= norm
    }
    return vector
}
