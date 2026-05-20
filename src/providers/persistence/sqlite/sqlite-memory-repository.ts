import type {
    ForgetInput,
    MemoryRepositoryContract,
    MemorySearchInput,
    SaveDiaryInput,
    SaveMemoriesInput,
    SaveMemoryInput,
    SaveOptions,
    SaveSessionInput,
} from '@/contracts/repositories/memory-repository'
import { type SqliteConnection, withTransaction } from '@/database/actions/_db'
import {
    addRelation,
    findEntityByCanonicalName,
    historicalRelations,
    searchEntities,
    traverseNeighbors,
    upsertEntity,
} from '@/database/services/graph'
import searchMemory from '@/database/services/search-memory'
import type {
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    SaveResult,
} from '@/models/memory'
import type { Project } from '@/models/project'
import forgetMemory from './forget-memory'
import {
    saveKonteksDiary,
    saveKonteksMemories,
    saveKonteksMemory,
    saveKonteksSession,
} from './save-konteks-input'

export default class SQLiteMemoryRepository
    implements MemoryRepositoryContract
{
    public constructor(
        private readonly db: SqliteConnection,
        private readonly project: Project,
    ) {}

    public async search(
        input: MemorySearchInput,
    ): Promise<MemorySearchResult[]> {
        const results = await searchMemory(this.db, input)
        return results.map(r => ({
            createdAt: r.createdAt,
            excerpt: r.excerpt,
            id: r.id,
            kind: r.kind,
            metadata: {
                sourceRole: r.sourceRole,
                targetType: r.targetType,
                task: r.task,
            },
            path: r.path,
            score: r.score,
            type: r.type,
        }))
    }

    public async saveMemory(
        input: SaveMemoryInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await saveKonteksMemory(this.db, this.project, input, options)
    }

    public async saveMemories(
        input: SaveMemoriesInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await saveKonteksMemories(this.db, this.project, input, options)
    }

    public async saveDiary(
        input: SaveDiaryInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await saveKonteksDiary(this.db, this.project, input, options)
    }

    public async saveSession(
        input: SaveSessionInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await saveKonteksSession(this.db, this.project, input, options)
    }

    public async forget(input: ForgetInput): Promise<ForgetResult> {
        return await forgetMemory(this.db, input)
    }

    public async upsertEntity(
        entity: Partial<MemoryEntity> & { name: string; type: string },
    ): Promise<MemoryEntity> {
        const record = await withTransaction(this.db, () =>
            upsertEntity({
                name: entity.name,
                properties: entity.properties,
                summary: entity.summary,
                type: entity.type,
            }),
        )
        return {
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }
    }

    public async addRelation(
        relation: Omit<MemoryRelation, 'id' | 'status'>,
    ): Promise<MemoryRelation> {
        const record = await withTransaction(this.db, () =>
            addRelation({
                confidence: relation.confidence,
                objectId: relation.objectId,
                predicate: relation.predicate,
                properties: relation.properties,
                subjectId: relation.subjectId,
                validFrom: relation.validFrom,
                validTo: relation.validTo,
            }),
        )
        return {
            confidence: record.confidence,
            id: record.id,
            objectId: record.objectId,
            predicate: record.predicate,
            status: record.status,
            subjectId: record.subjectId,
            validFrom: record.validFrom,
            validTo: record.validTo,
        }
    }

    public async findEntityByCanonicalName(
        name: string,
    ): Promise<MemoryEntity | undefined> {
        const record = await withTransaction(this.db, () =>
            findEntityByCanonicalName(name),
        )
        if (!record) return undefined
        return {
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }
    }

    public async searchEntities(
        query: string,
        limit?: number,
    ): Promise<MemoryEntity[]> {
        const records = await withTransaction(this.db, () =>
            searchEntities(query, { limit }),
        )
        return records.map(record => ({
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }))
    }

    public async traverseNeighbors(
        entityId: string,
        options?: { maxDepth?: number; limit?: number },
    ): Promise<GraphNeighbor[]> {
        return await withTransaction(this.db, () =>
            traverseNeighbors(entityId, options),
        )
    }

    public async historicalRelations(
        entityId: string,
        limit?: number,
    ): Promise<HistoricalRelation[]> {
        return await withTransaction(this.db, () =>
            historicalRelations(entityId, { limit }),
        )
    }
}
