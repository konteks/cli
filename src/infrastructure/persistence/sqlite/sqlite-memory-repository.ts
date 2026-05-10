import type {
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
} from '../../../domain/entities/memory.js'
import type { Project } from '../../../domain/entities/project.js'
import type {
    IMemoryRepository,
    SaveDiaryInput,
    SaveMemoryInput,
    SaveResult,
    SaveSessionInput,
} from '../../../domain/repositories/memory-repository.js'
import type { DatabaseService } from './db.js'
import { type MemoryKind, saveKonteksInput } from './save-store.js'
import { searchMemory } from './search-store.js'

export class SQLiteMemoryRepository implements IMemoryRepository {
    constructor(
        private readonly db: DatabaseService,
        private readonly project: Project,
    ) {}

    async search(query: string, limit?: number): Promise<MemorySearchResult[]> {
        const results = await searchMemory(this.db, { limit, query })
        return results.map(r => ({
            excerpt: r.excerpt,
            id: r.id,
            kind: this.mapTypeToKind(r.type),
            metadata: {
                kind: r.kind,
                sourceRole: r.sourceRole,
                type: r.type,
            },
            score: r.score,
            source: r.path || r.sourceId || 'unknown',
        }))
    }

    async saveMemory(input: SaveMemoryInput): Promise<SaveResult> {
        const result = await saveKonteksInput(this.db, this.project, {
            ...input,
            kind: input.kind as MemoryKind,
            type: 'memory',
        })
        return {
            accepted: result.accepted,
            duplicateOf: result.duplicateOf,
            id: result.id,
        }
    }

    async saveDiary(input: SaveDiaryInput): Promise<SaveResult> {
        const result = await saveKonteksInput(this.db, this.project, {
            ...input,
            type: 'diary',
        })
        return {
            accepted: result.accepted,
            id: result.id,
        }
    }

    async saveSession(input: SaveSessionInput): Promise<SaveResult> {
        const result = await saveKonteksInput(this.db, this.project, {
            ...input,
            type: 'session',
        })
        return {
            accepted: result.accepted,
            id: result.id,
        }
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

    private mapTypeToKind(
        type: string,
    ): 'session_diary' | 'durable_memory' | 'session_save' {
        if (type === 'diary') return 'session_diary'
        if (type === 'memory') return 'durable_memory'
        return 'session_save'
    }
}
