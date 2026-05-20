import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type { SqliteConnection } from '@/database/actions/_db'
import { executeSql, querySql } from '@/database/support/libsql'
import { contentHash } from '@/providers/persistence/objects/content'

type TargetType = 'chunk' | 'diary' | 'memory' | 'module'

type RetrievalDocumentRow = {
    target_id: string
    target_type: TargetType
    embedding_text: string
}

type ExistingEmbeddingRow = {
    embedding_hash: string
}

type EmbeddingWorkItem = {
    embeddingHash: string
    existing: boolean
    row: RetrievalDocumentRow
}

type EmbeddingRunResult = {
    embeddedCount: number
    reusedCount: number
}

export default async function generateTargetEmbeddings(
    db: SqliteConnection,
    provider: EmbeddingProviderContract,
    targetTypes: TargetType[],
    createdAt: string,
    options: {
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<EmbeddingRunResult> {
    if (targetTypes.length === 0) {
        return { embeddedCount: 0, reusedCount: 0 }
    }

    const placeholders = targetTypes.map(() => '?').join(', ')
    const rows = await querySql<RetrievalDocumentRow>(
        db.client,
        `
select target_id, target_type, embedding_text
from retrieval_documents
where target_type in (${placeholders})
`,
        targetTypes,
    )

    let embeddedCount = 0
    let reusedCount = 0
    const workItems: EmbeddingWorkItem[] = []

    for (const row of rows) {
        const existing = await querySql<ExistingEmbeddingRow>(
            db.client,
            `
select embedding_hash
from target_embeddings
where target_id = ?
  and target_type = ?
  and model = ?
  and dimensions = ?
limit 1
`,
            [
                row.target_id,
                row.target_type,
                provider.model,
                provider.dimensions,
            ],
        )

        const embeddingHash = contentHash(
            `${provider.model}:${row.embedding_text}`,
        )

        workItems.push({
            embeddingHash,
            existing: existing[0]?.embedding_hash === embeddingHash,
            row,
        })
    }

    if (workItems.some(item => !item.existing)) {
        await provider.prepare?.()
    }

    options.onProgress?.({
        current: 0,
        message: `Embedding ${rows.length} retrieval documents`,
        phase: 'embeddings',
        stage: 'embed',
        status: 'start',
        total: rows.length,
    })

    for (const [index, item] of workItems.entries()) {
        const { embeddingHash, row } = item

        if (item.existing) {
            reusedCount += 1
            options.onProgress?.({
                current: index + 1,
                embeddedCount,
                message: `Reused embedding for ${row.target_type}:${row.target_id}`,
                phase: 'embeddings',
                reusedCount,
                stage: 'embed',
                status: 'progress',
                total: rows.length,
            })
            continue
        }

        options.onProgress?.({
            current: index + 1,
            embeddedCount,
            message: `Embedding ${row.target_type}:${row.target_id}`,
            phase: 'embeddings',
            reusedCount,
            stage: 'embed',
            status: 'progress',
            total: rows.length,
        })
        const vectors = await provider.embed([row.embedding_text])
        const vector = vectors[0]
        if (!vector) {
            throw new Error(
                `Embedding provider returned no vector for ${row.target_type}:${row.target_id}.`,
            )
        }
        if (vector.length !== provider.dimensions) {
            throw new Error(
                `Embedding dimensions mismatch for ${row.target_type}:${row.target_id}. Expected ${provider.dimensions}, got ${vector.length}.`,
            )
        }

        await executeSql(
            db.client,
            `
insert or replace into target_embeddings (
    target_id,
    target_type,
    model,
    dimensions,
    dtype,
    normalized,
    embedding_hash,
    vector_blob,
    created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                row.target_id,
                row.target_type,
                provider.model,
                provider.dimensions,
                'float32',
                1,
                embeddingHash,
                toBlob(vector),
                createdAt,
            ],
        )
        embeddedCount += 1
        options.onProgress?.({
            current: index + 1,
            embeddedCount,
            message: `Embedded ${row.target_type}:${row.target_id}`,
            phase: 'embeddings',
            reusedCount,
            stage: 'embed',
            status: 'progress',
            total: rows.length,
        })
    }

    options.onProgress?.({
        embeddedCount,
        message: `Index ready: ${embeddedCount} indexed, ${reusedCount} unchanged`,
        phase: 'embeddings',
        reusedCount,
        stage: 'embed',
        status: 'done',
        total: rows.length,
    })

    return { embeddedCount, reusedCount }
}

function toBlob(vector: Float32Array): Uint8Array {
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}
