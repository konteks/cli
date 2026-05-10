import type {
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    SaveResult,
} from '@/domain/entities/memory.js'
import type { Project } from '@/domain/entities/project.js'
import type {
    ForgetInput,
    IMemoryRepository,
    MemorySearchInput,
    SaveInput,
    SaveOptions,
} from '@/domain/repositories/memory-repository.js'
import type { DatabaseService } from './db.js'
import { forgetMemory } from './forget-store.js'
import { saveKonteksInput } from './save-store.js'
import { searchMemory } from './search-store.js'

export class SQLiteMemoryRepository implements IMemoryRepository {
    constructor(
        private readonly db: DatabaseService,
        private readonly project: Project,
    ) {}

    async search(input: MemorySearchInput): Promise<MemorySearchResult[]> {
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

    async save(input: SaveInput, options?: SaveOptions): Promise<SaveResult> {
        const result = await saveKonteksInput(
            this.db,
            this.project,
            // biome-ignore lint/suspicious/noExplicitAny: domain-to-infrastructure union mapping
            input as any,
            options,
        )
        return {
            accepted: result.accepted,
            diaryId: result.diaryId,
            duplicateOf: result.duplicateOf,
            id: result.id,
            memoryIds: result.memoryIds,
            skippedMemories: result.skippedMemories,
        }
    }

    async forget(input: ForgetInput): Promise<ForgetResult> {
        return await forgetMemory(this.db, input)
    }

    async upsertEntity(
        entity: Partial<MemoryEntity> & { name: string; type: string },
    ): Promise<MemoryEntity> {
        const record = await this.db.graph.upsertEntity({
            name: entity.name,
            properties: entity.properties,
            summary: entity.summary,
            type: entity.type,
        })
        return {
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }
    }

    async addRelation(
        relation: Omit<MemoryRelation, 'id' | 'status'>,
    ): Promise<MemoryRelation> {
        const record = await this.db.graph.addRelation({
            confidence: relation.confidence,
            objectId: relation.objectId,
            predicate: relation.predicate,
            properties: relation.properties,
            subjectId: relation.subjectId,
            validFrom: relation.validFrom,
            validTo: relation.validTo,
        })
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

    async findEntityByCanonicalName(
        name: string,
    ): Promise<MemoryEntity | undefined> {
        const record = await this.db.graph.findEntityByCanonicalName(name)
        if (!record) return undefined
        return {
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }
    }

    async searchEntities(
        query: string,
        limit?: number,
    ): Promise<MemoryEntity[]> {
        const records = await this.db.graph.searchEntities(query, { limit })
        return records.map(record => ({
            canonicalName: record.canonicalName,
            id: record.id,
            name: record.name,
            summary: record.summary,
            type: record.type,
        }))
    }

    async traverseNeighbors(
        entityId: string,
        options?: { maxDepth?: number; limit?: number },
    ): Promise<GraphNeighbor[]> {
        return await this.db.graph.traverseNeighbors(entityId, options)
    }

    async historicalRelations(
        entityId: string,
        limit?: number,
    ): Promise<HistoricalRelation[]> {
        return await this.db.graph.historicalRelations(entityId, { limit })
    }
}
