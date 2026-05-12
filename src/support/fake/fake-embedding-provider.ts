import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'

export class FakeEmbeddingProvider implements EmbeddingProviderContract {
    readonly model = 'fake/all-MiniLM-L6-v2'
    readonly dimensions: number

    constructor(dimensions = 8) {
        this.dimensions = dimensions
    }

    async embed(texts: string[]): Promise<Float32Array[]> {
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
