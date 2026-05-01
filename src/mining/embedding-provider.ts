import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { env, pipeline } from '@huggingface/transformers'

export interface EmbeddingProvider {
    model: string
    dimensions: number
    embed(texts: string[]): Promise<Float32Array[]>
}

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
    readonly model = 'Xenova/all-MiniLM-L6-v2'
    readonly dimensions = 384

    private extractor:
        | ((text: string, options: Record<string, unknown>) => Promise<unknown>)
        | undefined

    async embed(texts: string[]): Promise<Float32Array[]> {
        if (texts.length === 0) {
            return []
        }

        const extractor = await this.getExtractor()
        const vectors: Float32Array[] = []

        for (const text of texts) {
            const output = await extractor(text, {
                normalize: true,
                pooling: 'mean',
            })
            vectors.push(toFloat32Array(output))
        }

        return vectors
    }

    private async getExtractor(): Promise<
        (text: string, options: Record<string, unknown>) => Promise<unknown>
    > {
        if (this.extractor) {
            return this.extractor
        }

        const cacheDir = resolveGlobalModelCacheDir()
        await mkdir(cacheDir, { recursive: true })
        env.cacheDir = cacheDir

        this.extractor = (await pipeline(
            'feature-extraction',
            this.model,
        )) as unknown as (
            text: string,
            options: Record<string, unknown>,
        ) => Promise<unknown>
        return this.extractor
    }
}

export class FakeEmbeddingProvider implements EmbeddingProvider {
    readonly model = 'fake/all-MiniLM-L6-v2'
    readonly dimensions: number

    constructor(dimensions = 8) {
        this.dimensions = dimensions
    }

    async embed(texts: string[]): Promise<Float32Array[]> {
        return texts.map(text => deterministicVector(text, this.dimensions))
    }
}

function resolveGlobalModelCacheDir(): string {
    if (process.env.KONTEKS_MODEL_CACHE_DIR) {
        return resolve(process.env.KONTEKS_MODEL_CACHE_DIR)
    }
    return join(homedir(), '.cache', 'konteks', 'models')
}

function toFloat32Array(value: unknown): Float32Array {
    if (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        (value as { data: unknown }).data instanceof Float32Array
    ) {
        return (value as { data: Float32Array }).data
    }

    if (Array.isArray(value)) {
        const numeric = value
            .flat(Infinity)
            .filter(item => typeof item === 'number') as number[]
        return Float32Array.from(numeric)
    }

    throw new Error('Unsupported embedding output format from provider.')
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
