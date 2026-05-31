import { isSqliteTestRuntime } from '@/database/support/test-runtime'
import type { EmbeddingProviderContract } from '@/types/embedding-provider'
import HuggingFaceEmbeddingProvider from './hugging-face-embedding-provider'

declare global {
    var __konteksEmbeddingProviderForTests:
        | EmbeddingProviderContract
        | undefined
}

let provider: EmbeddingProviderContract | undefined

export default function sharedEmbeddingProvider():
    | EmbeddingProviderContract
    | undefined {
    if (globalThis.__konteksEmbeddingProviderForTests) {
        return globalThis.__konteksEmbeddingProviderForTests
    }
    if (isSqliteTestRuntime()) {
        return undefined
    }

    provider ??= new HuggingFaceEmbeddingProvider()
    return provider
}
