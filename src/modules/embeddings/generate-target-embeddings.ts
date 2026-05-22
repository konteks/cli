import { and, eq, inArray } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import { retrievalDocuments, targetEmbeddings } from '@/database/schema'
import { contentHash } from '@/modules/persistence/objects/content'
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
    existing: boolean
    row: RetrievalDocumentRow
}

type EmbeddingRunResult = {
    embeddedCount: number
    reusedCount: number
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

    let embeddedCount = 0
    let reusedCount = 0
    const workItems: EmbeddingWorkItem[] = []

    for (const row of rows) {
        const existing = await db
            .select({ embedding_hash: targetEmbeddings.embeddingHash })
            .from(targetEmbeddings)
            .where(
                and(
                    eq(targetEmbeddings.targetId, row.target_id),
                    eq(targetEmbeddings.targetType, row.target_type),
                    eq(targetEmbeddings.model, provider.model),
                    eq(targetEmbeddings.dimensions, provider.dimensions),
                ),
            )
            .limit(1)

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
