import {
    blob,
    index,
    integer,
    primaryKey,
    real,
    type SQLiteColumn,
    sqliteTable,
    text,
} from 'drizzle-orm/sqlite-core'
import type { ObservationKind } from '@/types/memory'

export const sources = sqliteTable(
    'sources',
    {
        createdAt: text('created_at').notNull(),
        entitiesJson: text('entities_json'),
        excerptRef: text('excerpt_ref'),
        id: text('id').primaryKey(),
        language: text('language'),
        metadataJson: text('metadata_json'),
        sourceRole: text('source_role'),
        topicsJson: text('topics_json'),
        type: text('type').notNull(),
        uri: text('uri'),
    },
    table => [index('sources_role_idx').on(table.sourceRole)],
)

export const sections = sqliteTable(
    'sections',
    {
        anchor: text('anchor'),
        anchorType: text('anchor_type'),
        contentHash: text('content_hash').notNull(),
        contentInline: text('content_inline'),
        createdAt: text('created_at').notNull(),
        deletedAt: text('deleted_at'),
        endLine: integer('end_line'),
        entitiesJson: text('entities_json'),
        forgetReason: text('forget_reason'),
        heading: text('heading'),
        id: text('id').primaryKey(),
        jsonPath: text('json_path'),
        kind: text('kind').notNull(),
        language: text('language'),
        metadataJson: text('metadata_json'),
        path: text('path'),
        sourceId: text('source_id').references(() => sources.id),
        sourceRole: text('source_role'),
        startLine: integer('start_line'),
        summary: text('summary'),
        suppressedAt: text('suppressed_at'),
        symbol: text('symbol'),
        tokenCount: integer('token_count').notNull().default(0),
        topicsJson: text('topics_json'),
        updatedAt: text('updated_at').notNull(),
    },
    table => [
        index('sections_anchor_idx').on(table.path, table.anchor),
        index('sections_content_hash_idx').on(table.contentHash),
        index('sections_deleted_idx').on(table.deletedAt, table.suppressedAt),
        index('sections_role_idx').on(table.sourceRole),
        index('sections_source_idx').on(table.sourceId),
    ],
)

export const entities = sqliteTable('entities', {
    canonicalName: text('canonical_name').notNull(),
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    propertiesJson: text('properties_json'),
    summary: text('summary'),
    type: text('type').notNull(),
    updatedAt: text('updated_at').notNull(),
})

export const entityAliases = sqliteTable(
    'entity_aliases',
    {
        createdAt: text('created_at').notNull(),
        entityId: text('entity_id')
            .notNull()
            .references(() => entities.id),
        id: text('id').primaryKey(),
        normalizedValue: text('normalized_value').notNull(),
        value: text('value').notNull(),
    },
    table => [index('aliases_normalized_value_idx').on(table.normalizedValue)],
)

export const relations = sqliteTable(
    'relations',
    {
        confidence: real('confidence').notNull().default(1.0),
        createdAt: text('created_at').notNull(),
        id: text('id').primaryKey(),
        objectId: text('object_id')
            .notNull()
            .references(() => entities.id),
        predicate: text('predicate').notNull(),
        propertiesJson: text('properties_json'),
        status: text('status').notNull().default('active'),
        subjectId: text('subject_id')
            .notNull()
            .references(() => entities.id),
        supersedesRelationId: text('supersedes_relation_id'),
        updatedAt: text('updated_at').notNull(),
        validFrom: text('valid_from'),
        validTo: text('valid_to'),
    },
    table => [
        index('relations_object_idx').on(table.objectId, table.status),
        index('relations_subject_idx').on(table.subjectId, table.status),
    ],
)

export const observations = sqliteTable(
    'observations',
    {
        confidence: real('confidence').notNull().default(1.0),
        contentHash: text('content_hash'),
        createdAt: text('created_at').notNull(),
        deletedAt: text('deleted_at'),
        forgetReason: text('forget_reason'),
        id: text('id').primaryKey(),
        kind: text('kind').$type<ObservationKind>().notNull(),
        suppressedAt: text('suppressed_at'),
        textInline: text('text_inline'),
    },
    table => [
        index('observations_content_hash_idx').on(table.contentHash),
        index('observations_deleted_idx').on(
            table.deletedAt,
            table.suppressedAt,
        ),
    ],
)

export const diaryEntries = sqliteTable(
    'diary_entries',
    {
        contentHash: text('content_hash'),
        createdAt: text('created_at').notNull(),
        deletedAt: text('deleted_at'),
        forgetReason: text('forget_reason'),
        id: text('id').primaryKey(),
        subject: text('subject'),
        summary: text('summary').notNull(),
        suppressedAt: text('suppressed_at'),
        tagsJson: text('tags_json'),
    },
    table => [
        index('diary_entries_deleted_idx').on(
            table.deletedAt,
            table.suppressedAt,
        ),
    ],
)

export const memoryEvents = sqliteTable(
    'memory_events',
    {
        actor: text('actor'),
        createdAt: text('created_at').notNull(),
        eventType: text('event_type').notNull(),
        id: text('id').primaryKey(),
        sourceId: text('source_id').references(() => sources.id),
        subjectId: text('subject_id'),
        subjectType: text('subject_type').notNull(),
        summary: text('summary').notNull(),
    },
    table => [
        index('memory_events_created_at_idx').on(table.createdAt),
        index('memory_events_subject_idx').on(
            table.subjectType,
            table.subjectId,
        ),
    ],
)

export const taxonomyNodes = sqliteTable('taxonomy_nodes', {
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    parentId: text('parent_id').references(
        (): SQLiteColumn => taxonomyNodes.id,
    ),
    summary: text('summary'),
    updatedAt: text('updated_at').notNull(),
})

export const taxonomyLinks = sqliteTable('taxonomy_links', {
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    nodeId: text('node_id')
        .notNull()
        .references(() => taxonomyNodes.id),
    targetId: text('target_id').notNull(),
    targetType: text('target_type').notNull(),
})

export const retrievalDocuments = sqliteTable(
    'retrieval_documents',
    {
        anchor: text('anchor'),
        embeddingHash: text('embedding_hash').notNull(),
        embeddingText: text('embedding_text').notNull(),
        ftsHash: text('fts_hash').notNull(),
        ftsText: text('fts_text').notNull(),
        path: text('path'),
        sourceId: text('source_id'),
        sourceRole: text('source_role'),
        summary: text('summary'),
        targetId: text('target_id').notNull(),
        targetType: text('target_type')
            .$type<'section' | 'diary' | 'memory' | 'module'>()
            .notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    table => [
        primaryKey({ columns: [table.targetId, table.targetType] }),
        index('retrieval_documents_role_idx').on(table.sourceRole),
        index('retrieval_documents_source_idx').on(table.sourceId),
        index('retrieval_documents_target_idx').on(
            table.targetType,
            table.targetId,
        ),
    ],
)

export const targetEmbeddings = sqliteTable(
    'target_embeddings',
    {
        createdAt: text('created_at').notNull(),
        dimensions: integer('dimensions').notNull(),
        dtype: text('dtype').notNull(),
        embeddingHash: text('embedding_hash').notNull(),
        model: text('model').notNull(),
        normalized: integer('normalized').notNull(),
        targetId: text('target_id').notNull(),
        targetType: text('target_type')
            .$type<'section' | 'diary' | 'memory' | 'module'>()
            .notNull(),
        vectorBlob: blob('vector_blob').$type<Uint8Array>().notNull(),
    },
    table => [
        index('target_embeddings_hash_idx').on(table.embeddingHash),
        primaryKey({
            columns: [table.targetId, table.targetType, table.model],
        }),
    ],
)

export const modules = sqliteTable(
    'modules',
    {
        entitiesJson: text('entities_json'),
        exportedSymbolsJson: text('exported_symbols_json'),
        fileCount: integer('file_count').notNull().default(0),
        id: text('id').primaryKey(),
        importsJson: text('imports_json'),
        packageName: text('package_name'),
        path: text('path').notNull(),
        sectionCount: integer('section_count').notNull().default(0),
        sourceRole: text('source_role'),
        summary: text('summary').notNull(),
        topicsJson: text('topics_json'),
        updatedAt: text('updated_at').notNull(),
    },
    table => [index('modules_path_idx').on(table.path)],
)

export const sectionSuppressions = sqliteTable(
    'section_suppressions',
    {
        anchor: text('anchor').notNull(),
        contentHash: text('content_hash').notNull(),
        createdAt: text('created_at').notNull(),
        path: text('path').notNull(),
        reason: text('reason'),
    },
    table => [
        index('section_suppressions_path_idx').on(table.path),
        primaryKey({
            columns: [table.path, table.anchor, table.contentHash],
        }),
    ],
)

export const memoryFtsIndexed = sqliteTable('memory_fts_indexed', {
    id: text('id').primaryKey(),
    indexedAt: text('indexed_at').notNull(),
})

// FTS5 virtual-table DDL, including `unindexed` metadata, is owned by SQL migrations.
export const memoryFts = sqliteTable('memory_fts', {
    content: text('content').notNull(),
    createdAt: text('created_at').notNull(),
    id: text('id').notNull(),
    kind: text('kind'),
    task: text('task'),
    type: text('type').$type<'section' | 'diary' | 'memory'>().notNull(),
})

export const retrievalDocumentsFts = sqliteTable('retrieval_documents_fts', {
    anchor: text('anchor'),
    ftsText: text('fts_text').notNull(),
    path: text('path'),
    sourceRole: text('source_role'),
    targetId: text('target_id').notNull(),
    targetType: text('target_type')
        .$type<'section' | 'diary' | 'memory' | 'module'>()
        .notNull(),
})
