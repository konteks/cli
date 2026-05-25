import { and, eq, inArray, or } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import { retrievalDocuments, targetEmbeddings } from '@/database/schema'
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
    existing: boolean
    row: RetrievalDocumentRow
}

type ExistingEmbeddingRow = {
    embedding_hash: string
    target_id: string
    target_type: TargetType
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
            existing:
                existingHashes.get(
                    targetKey(row.target_type, row.target_id),
                ) === embeddingHash,
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

async function loadExistingEmbeddingHashes(
    provider: EmbeddingProviderContract,
    rows: RetrievalDocumentRow[],
): Promise<Map<string, string>> {
    if (rows.length === 0) {
        return new Map()
    }

    const db = await getDb()
    const targetTypes = [...new Set(rows.map(row => row.target_type))]
    const existingRows = await db
        .select({
            embedding_hash: targetEmbeddings.embeddingHash,
            target_id: targetEmbeddings.targetId,
            target_type: targetEmbeddings.targetType,
        })
        .from(targetEmbeddings)
        .where(
            and(
                eq(targetEmbeddings.model, provider.model),
                eq(targetEmbeddings.dimensions, provider.dimensions),
                inArray(targetEmbeddings.targetType, targetTypes),
            ),
        )

    const rowKeys = new Set(
        rows.map(row => targetKey(row.target_type, row.target_id)),
    )
    const hashes = new Map<string, string>()
    for (const row of existingRows as ExistingEmbeddingRow[]) {
        const key = targetKey(row.target_type, row.target_id)
        if (rowKeys.has(key)) {
            hashes.set(key, row.embedding_hash)
        }
    }
    return hashes
}

function targetKey(targetType: TargetType, targetId: string): string {
    return `${targetType}:${targetId}`
}

function toBlob(vector: Float32Array): Uint8Array {
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}
