import { and, eq, inArray, sql } from 'drizzle-orm'
import { getLoadablePath } from 'sqlite-vec'
import getDb, { projectDatabasePath } from '@/database/actions/_db'
import { vectorIndexEntries } from '@/database/schema'
import { isSqliteTestRuntime } from '@/database/support/test-runtime'
import { loadProjectContext } from '@/modules/project/context'

type TargetType = 'section' | 'diary' | 'memory' | 'module'

export type VectorIndexTarget = {
    createdAt: string
    dimensions: number
    embeddingHash: string
    model: string
    targetId: string
    targetType: TargetType
    vector: Float32Array
}

export type VectorSearchResult = {
    distance: number
    embeddingHash: string
    model: string
    targetId: string
    targetType: TargetType
}

type StatementResult = {
    lastInsertRowid: bigint | number
}

type StatementSync = {
    all(...values: unknown[]): unknown[]
    get(...values: unknown[]): unknown
    run(...values: unknown[]): StatementResult
}

type DatabaseSync = {
    close?(): void
    exec(sql: string): void
    loadExtension(path: string): void
    prepare(sql: string): StatementSync
}

type NodeSqliteModule = {
    DatabaseSync: new (
        path: string,
        options: { allowExtension: boolean },
    ) => DatabaseSync
}

type VectorIndexConnection = {
    database: DatabaseSync
    path: string
}

type VectorIndexConnectionFactory = () => Promise<
    VectorIndexConnection | undefined
>

type VectorEmbeddingRow = {
    embedding_hash: string
    model: string
    target_id: string
    target_type: TargetType
    vector_blob: ArrayBuffer | Uint8Array
}

declare global {
    var __konteksVectorIndexConnectionFactoryForTests:
        | VectorIndexConnectionFactory
        | undefined
}

const connections = new Map<string, VectorIndexConnection>()

class VectorIndexDependencyError extends Error {
    public constructor(message: string, options?: { cause?: unknown }) {
        super(message, options)
        this.name = 'VectorIndexDependencyError'
    }
}

export async function upsertVectorIndexTarget(
    target: VectorIndexTarget,
): Promise<boolean> {
    const connection = await vectorConnection()
    if (!connection) {
        return false
    }

    const vecTable = tableNameForDimensions(target.dimensions)
    ensureVectorTable(connection.database, vecTable, target.dimensions)
    connection.database
        .prepare(
            `
delete from ${vecTable}
where target_id = ?
  and target_type = ?
  and model = ?
`,
        )
        .run(target.targetId, target.targetType, target.model)
    connection.database
        .prepare(
            `
insert into ${vecTable} (
    embedding,
    target_id,
    target_type,
    model,
    embedding_hash
) values (?, ?, ?, ?, ?)
`,
        )
        .run(
            vectorToBlob(target.vector),
            target.targetId,
            target.targetType,
            target.model,
            target.embeddingHash,
        )

    await upsertVectorIndexEntry(target, vecTable)
    return true
}

export async function deleteVectorIndexTargets(
    targetType: TargetType,
    targetIds?: string[],
): Promise<void> {
    if (targetIds && targetIds.length === 0) {
        return
    }

    await deleteVectorIndexEntries(targetType, targetIds)

    const connection = await vectorConnection()
    if (!connection) {
        return
    }

    const tables = vectorTableNames(connection.database)
    for (const table of tables) {
        if (targetIds && targetIds.length > 0) {
            const placeholders = targetIds.map(() => '?').join(', ')
            connection.database
                .prepare(
                    `
delete from ${table}
where target_type = ?
  and target_id in (${placeholders})
`,
                )
                .run(targetType, ...targetIds)
            continue
        }

        connection.database
            .prepare(`delete from ${table} where target_type = ?`)
            .run(targetType)
    }
}

export async function searchVectorIndex(input: {
    dimensions: number
    limit: number
    model: string
    vector: Float32Array
}): Promise<VectorSearchResult[]> {
    const connection = await vectorConnection()
    if (!connection) {
        return exactVectorSearch(input)
    }

    const vecTable = tableNameForDimensions(input.dimensions)
    if (!hasVectorTable(connection.database, vecTable)) {
        return exactVectorSearch(input)
    }

    return connection.database
        .prepare(
            `
select
    distance,
    embedding_hash as embeddingHash,
    model,
    target_id as targetId,
    target_type as targetType
from ${vecTable}
where embedding match ?
  and model = ?
  and k = ?
`,
        )
        .all(vectorToBlob(input.vector), input.model, input.limit)
        .map(toVectorSearchResult)
}

function ensureVectorTable(
    database: DatabaseSync,
    tableName: string,
    dimensions: number,
): void {
    database.exec(`
create virtual table if not exists ${tableName} using vec0(
    embedding float[${dimensions}],
    target_id text,
    target_type text,
    model text,
    embedding_hash text
);
`)
}

function hasVectorTable(database: DatabaseSync, tableName: string): boolean {
    const row = database
        .prepare(
            `
select name
from sqlite_master
where type = 'table'
  and name = ?
limit 1
`,
        )
        .get(tableName)

    return Boolean(row)
}

function vectorTableNames(database: DatabaseSync): string[] {
    return database
        .prepare(
            `
select name
from sqlite_master
where type = 'table'
  and name glob 'vector_index_[0-9]*'
`,
        )
        .all()
        .map(row => (row as { name: string }).name)
        .filter(safeVectorTableName)
}

async function vectorConnection(): Promise<VectorIndexConnection | undefined> {
    if (globalThis.__konteksVectorIndexConnectionFactoryForTests) {
        return globalThis.__konteksVectorIndexConnectionFactoryForTests()
    }

    if (isSqliteTestRuntime()) {
        return undefined
    }

    const context = await loadProjectContext()
    const path = projectDatabasePath(context)
    const existing = connections.get(path)
    if (existing) {
        return existing
    }

    const sqlite = await loadNodeSqlite()
    if (!sqlite) {
        return undefined
    }

    const database = new sqlite.DatabaseSync(path, { allowExtension: true })
    try {
        database.loadExtension(getLoadablePath())
    } catch (error) {
        try {
            database.close?.()
        } catch {
            // Preserve the actionable sqlite-vec load failure.
        }
        throw new VectorIndexDependencyError(
            'Failed to load the required sqlite-vec native extension. Reinstall project dependencies so the sqlite-vec platform package is available.',
            { cause: error },
        )
    }

    const connection = { database, path }
    connections.set(path, connection)
    return connection
}

async function loadNodeSqlite(): Promise<NodeSqliteModule | undefined> {
    try {
        return (await import('node:sqlite')) as NodeSqliteModule
    } catch {
        return undefined
    }
}

async function exactVectorSearch(input: {
    dimensions: number
    limit: number
    model: string
    vector: Float32Array
}): Promise<VectorSearchResult[]> {
    const db = await getDb()
    const rows = await db.all<VectorEmbeddingRow>(sql`
select
    embedding_hash,
    model,
    target_id,
    target_type,
    vector_blob
from target_embeddings
where model = ${input.model}
  and dimensions = ${input.dimensions}
`)

    return rows
        .map(row => ({
            distance: cosineDistance(
                input.vector,
                blobToFloat32Array(row.vector_blob),
            ),
            embeddingHash: row.embedding_hash,
            model: row.model,
            targetId: row.target_id,
            targetType: row.target_type,
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, input.limit)
}

function cosineDistance(left: Float32Array, right: Float32Array): number {
    let dot = 0
    let leftNorm = 0
    let rightNorm = 0
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index] ?? 0
        const rightValue = right[index] ?? 0
        dot += leftValue * rightValue
        leftNorm += leftValue * leftValue
        rightNorm += rightValue * rightValue
    }

    if (leftNorm === 0 || rightNorm === 0) {
        return 1
    }

    return 1 - dot / Math.sqrt(leftNorm * rightNorm)
}

function toVectorSearchResult(row: unknown): VectorSearchResult {
    const value = row as {
        distance: number
        embeddingHash: string
        model: string
        targetId: string
        targetType: TargetType
    }
    return {
        distance: value.distance,
        embeddingHash: value.embeddingHash,
        model: value.model,
        targetId: value.targetId,
        targetType: value.targetType,
    }
}

function vectorToBlob(vector: Float32Array): Uint8Array {
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

function tableNameForDimensions(dimensions: number): string {
    return `vector_index_${dimensions}`
}

function safeVectorTableName(tableName: string): boolean {
    return /^vector_index_\d+$/u.test(tableName)
}

async function upsertVectorIndexEntry(
    target: VectorIndexTarget,
    indexTable: string,
): Promise<void> {
    const db = await getDb()
    await db
        .insert(vectorIndexEntries)
        .values({
            dimensions: target.dimensions,
            embeddingHash: target.embeddingHash,
            indexTable,
            model: target.model,
            targetId: target.targetId,
            targetType: target.targetType,
            updatedAt: target.createdAt,
        })
        .onConflictDoUpdate({
            set: {
                dimensions: target.dimensions,
                embeddingHash: target.embeddingHash,
                indexTable,
                updatedAt: target.createdAt,
            },
            target: [
                vectorIndexEntries.targetId,
                vectorIndexEntries.targetType,
                vectorIndexEntries.model,
            ],
        })
}

async function deleteVectorIndexEntries(
    targetType: TargetType,
    targetIds?: string[],
): Promise<void> {
    if (targetIds && targetIds.length === 0) {
        return
    }

    const db = await getDb()

    if (targetIds && targetIds.length > 0) {
        await db
            .delete(vectorIndexEntries)
            .where(
                and(
                    eq(vectorIndexEntries.targetType, targetType),
                    inArray(vectorIndexEntries.targetId, targetIds),
                ),
            )
        return
    }

    await db
        .delete(vectorIndexEntries)
        .where(eq(vectorIndexEntries.targetType, targetType))
}
