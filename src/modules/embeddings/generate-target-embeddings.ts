import { and, eq, inArray, or, sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import { retrievalDocuments, targetEmbeddings } from '@/database/schema'
import { upsertVectorIndexTarget } from '@/database/services/vector-index'
import contentHash from '@/support/content-hash'
import type { EmbeddingProviderContract } from '@/types/embedding-provider'
import type { ExtractionProgressReporter } from '@/types/progress'

type TargetType = 'section' | 'diary' | 'memory' | 'module'

type RetrievalDocumentRow = {
    target_id: string
    target_type: TargetType
    embedding_text: string
}

type EmbeddingWorkItem = {
    embeddingHash: string
    existingEmbedding?: ExistingEmbeddingRow
    status: 'fresh' | 'needs-embedding' | 'needs-vector-index'
    row: RetrievalDocumentRow
}

type ExistingEmbeddingRow = {
    embedding_hash: string
    target_id: string
    target_type: TargetType
    vector_blob: ArrayBuffer | Uint8Array
    vector_index_dimensions: number | null
    vector_index_hash: string | null
    vector_index_table: string | null
}

type EmbeddingRunResult = {
    embeddedCount: number
    reusedCount: number
}

export type EmbeddingTarget = {
    targetId: string
    targetType: TargetType
}

export default async function generateTargetEmbeddings(
    provider: EmbeddingProviderContract,
    targetTypes: TargetType[],
    createdAt: string,
    options: {
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<EmbeddingRunResult> {
    const db = await getDb()
    if (targetTypes.length === 0) {
        return { embeddedCount: 0, reusedCount: 0 }
    }

    const rows = await db
        .select({
            embedding_text: retrievalDocuments.embeddingText,
            target_id: retrievalDocuments.targetId,
            target_type: retrievalDocuments.targetType,
        })
        .from(retrievalDocuments)
        .where(inArray(retrievalDocuments.targetType, targetTypes))

    return await embedRetrievalDocumentRows(provider, rows, createdAt, options)
}

export async function generateEmbeddingsForTargets(
    provider: EmbeddingProviderContract,
    targets: EmbeddingTarget[],
    createdAt: string,
    options: {
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<EmbeddingRunResult> {
    const db = await getDb()
    if (targets.length === 0) {
        return { embeddedCount: 0, reusedCount: 0 }
    }

    const clauses = targets.map(target =>
        and(
            eq(retrievalDocuments.targetId, target.targetId),
            eq(retrievalDocuments.targetType, target.targetType),
        ),
    )
    const rows = await db
        .select({
            embedding_text: retrievalDocuments.embeddingText,
            target_id: retrievalDocuments.targetId,
            target_type: retrievalDocuments.targetType,
        })
        .from(retrievalDocuments)
        .where(or(...clauses))

    return await embedRetrievalDocumentRows(provider, rows, createdAt, options)
}

async function embedRetrievalDocumentRows(
    provider: EmbeddingProviderContract,
    rows: RetrievalDocumentRow[],
    createdAt: string,
    options: {
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<EmbeddingRunResult> {
    const db = await getDb()
    let embeddedCount = 0
    let reusedCount = 0
    const workItems: EmbeddingWorkItem[] = []
    const existingHashes = await loadExistingEmbeddingHashes(provider, rows)

    for (const row of rows) {
        const embeddingHash = contentHash(
            `${provider.model}:${row.embedding_text}`,
        )

        workItems.push({
            embeddingHash,
            existingEmbedding: existingHashes.get(
                targetKey(row.target_type, row.target_id),
            ),
            row,
            status: workItemStatus(
                existingHashes.get(targetKey(row.target_type, row.target_id)),
                embeddingHash,
                provider.dimensions,
            ),
        })
    }

    if (workItems.some(item => item.status === 'needs-embedding')) {
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

        if (item.status === 'fresh') {
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

        if (item.status === 'needs-vector-index' && item.existingEmbedding) {
            const vector = blobToFloat32Array(
                item.existingEmbedding.vector_blob,
            )
            await upsertVectorIndexTarget({
                createdAt,
                dimensions: provider.dimensions,
                embeddingHash,
                model: provider.model,
                targetId: row.target_id,
                targetType: row.target_type,
                vector,
            })
            reusedCount += 1
            options.onProgress?.({
                current: index + 1,
                embeddedCount,
                message: `Repaired vector index for ${row.target_type}:${row.target_id}`,
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

        await db
            .insert(targetEmbeddings)
            .values({
                createdAt,
                dimensions: provider.dimensions,
                dtype: 'float32',
                embeddingHash,
                model: provider.model,
                normalized: 1,
                targetId: row.target_id,
                targetType: row.target_type,
                vectorBlob: toBlob(vector),
            })
            .onConflictDoUpdate({
                set: {
                    createdAt,
                    dimensions: provider.dimensions,
                    dtype: 'float32',
                    embeddingHash,
                    normalized: 1,
                    vectorBlob: toBlob(vector),
                },
                target: [
                    targetEmbeddings.targetId,
                    targetEmbeddings.targetType,
                    targetEmbeddings.model,
                ],
            })
        await upsertVectorIndexTarget({
            createdAt,
            dimensions: provider.dimensions,
            embeddingHash,
            model: provider.model,
            targetId: row.target_id,
            targetType: row.target_type,
            vector,
        })
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

async function loadExistingEmbeddingHashes(
    provider: EmbeddingProviderContract,
    rows: RetrievalDocumentRow[],
): Promise<Map<string, ExistingEmbeddingRow>> {
    if (rows.length === 0) {
        return new Map()
    }

    const db = await getDb()
    const targetTypes = [...new Set(rows.map(row => row.target_type))]
    const existingRows = await db.all<ExistingEmbeddingRow>(sql`
select
    te.embedding_hash,
    te.target_id,
    te.target_type,
    te.vector_blob,
    vie.dimensions as vector_index_dimensions,
    vie.embedding_hash as vector_index_hash,
    vie.index_table as vector_index_table
from target_embeddings te
left join vector_index_entries vie
  on vie.target_id = te.target_id
 and vie.target_type = te.target_type
 and vie.model = te.model
where te.model = ${provider.model}
  and te.dimensions = ${provider.dimensions}
  and te.target_type in (${sql.join(
      targetTypes.map(type => sql`${type}`),
      sql`, `,
  )})
`)

    const rowKeys = new Set(
        rows.map(row => targetKey(row.target_type, row.target_id)),
    )
    const hashes = new Map<string, ExistingEmbeddingRow>()
    for (const row of existingRows) {
        const key = targetKey(row.target_type, row.target_id)
        if (rowKeys.has(key)) {
            hashes.set(key, row)
        }
    }
    return hashes
}

function workItemStatus(
    existing: ExistingEmbeddingRow | undefined,
    embeddingHash: string,
    dimensions: number,
): EmbeddingWorkItem['status'] {
    if (!existing || existing.embedding_hash !== embeddingHash) {
        return 'needs-embedding'
    }
    if (blobDimensions(existing.vector_blob) !== dimensions) {
        return 'needs-embedding'
    }
    if (
        existing.vector_index_hash !== embeddingHash ||
        existing.vector_index_dimensions !== dimensions ||
        existing.vector_index_table !== `vector_index_${dimensions}`
    ) {
        return 'needs-vector-index'
    }
    return 'fresh'
}

function targetKey(targetType: TargetType, targetId: string): string {
    return `${targetType}:${targetId}`
}

function toBlob(vector: Float32Array): Uint8Array {
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}

function blobToFloat32Array(blob: ArrayBuffer | Uint8Array): Float32Array {
    if (blob instanceof ArrayBuffer) {
        return new Float32Array(blob.slice(0))
    }

    const buffer = blob.buffer.slice(
        blob.byteOffset,
        blob.byteOffset + blob.byteLength,
    )
    return new Float32Array(buffer)
}

function blobDimensions(blob: ArrayBuffer | Uint8Array): number {
    return blob.byteLength / Float32Array.BYTES_PER_ELEMENT
}
