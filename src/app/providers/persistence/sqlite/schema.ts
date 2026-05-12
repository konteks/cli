import {
    blob,
    integer,
    primaryKey,
    real,
    type SQLiteColumn,
    sqliteTable,
    text,
} from 'drizzle-orm/sqlite-core'

export const sources = sqliteTable('sources', {
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
})

export const chunks = sqliteTable('chunks', {
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
    payloadRef: text('payload_ref'),
    sourceId: text('source_id').references(() => sources.id),
    sourceRole: text('source_role'),
    startLine: integer('start_line'),
    summary: text('summary'),
    suppressedAt: text('suppressed_at'),
    symbol: text('symbol'),
    tokenCount: integer('token_count').notNull().default(0),
    topicsJson: text('topics_json'),
    updatedAt: text('updated_at').notNull(),
})

export const embeddings = sqliteTable('embeddings', {
    chunkId: text('chunk_id')
        .primaryKey()
        .references(() => chunks.id),
    createdAt: text('created_at').notNull(),
    dimensions: integer('dimensions').notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    vectorRef: text('vector_ref').notNull(),
})

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

export const entityAliases = sqliteTable('entity_aliases', {
    createdAt: text('created_at').notNull(),
    entityId: text('entity_id')
        .notNull()
        .references(() => entities.id),
    id: text('id').primaryKey(),
    normalizedValue: text('normalized_value').notNull(),
    value: text('value').notNull(),
})

export const relations = sqliteTable('relations', {
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
})

export const observations = sqliteTable('observations', {
    confidence: real('confidence').notNull().default(1.0),
    contentHash: text('content_hash'),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
    forgetReason: text('forget_reason'),
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    payloadRef: text('payload_ref'),
    suppressedAt: text('suppressed_at'),
    textInline: text('text_inline'),
})

export const diaryEntries = sqliteTable('diary_entries', {
    contentHash: text('content_hash'),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
    forgetReason: text('forget_reason'),
    id: text('id').primaryKey(),
    payloadRef: text('payload_ref'),
    subject: text('subject'),
    summary: text('summary').notNull(),
    suppressedAt: text('suppressed_at'),
    tagsJson: text('tags_json'),
})

export const memoryEvents = sqliteTable('memory_events', {
    actor: text('actor'),
    createdAt: text('created_at').notNull(),
    eventType: text('event_type').notNull(),
    id: text('id').primaryKey(),
    payloadRef: text('payload_ref'),
    sourceId: text('source_id').references(() => sources.id),
    subjectId: text('subject_id'),
    subjectType: text('subject_type').notNull(),
    summary: text('summary').notNull(),
})

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
        targetType: text('target_type').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    table => ({
        pk: primaryKey({ columns: [table.targetId, table.targetType] }),
    }),
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
        targetType: text('target_type').notNull(),
        vectorBlob: blob('vector_blob').notNull(),
    },
    table => ({
        pk: primaryKey({
            columns: [table.targetId, table.targetType, table.model],
        }),
    }),
)

export const modules = sqliteTable('modules', {
    chunkCount: integer('chunk_count').notNull().default(0),
    entitiesJson: text('entities_json'),
    exportedSymbolsJson: text('exported_symbols_json'),
    fileCount: integer('file_count').notNull().default(0),
    id: text('id').primaryKey(),
    importsJson: text('imports_json'),
    packageName: text('package_name'),
    path: text('path').notNull(),
    sourceRole: text('source_role'),
    summary: text('summary').notNull(),
    topicsJson: text('topics_json'),
    updatedAt: text('updated_at').notNull(),
})

export const minedSuppressions = sqliteTable(
    'mined_suppressions',
    {
        anchor: text('anchor').notNull(),
        contentHash: text('content_hash').notNull(),
        createdAt: text('created_at').notNull(),
        path: text('path').notNull(),
        reason: text('reason'),
    },
    table => ({
        pk: primaryKey({
            columns: [table.path, table.anchor, table.contentHash],
        }),
    }),
)

export const memoryFtsIndexed = sqliteTable('memory_fts_indexed', {
    id: text('id').primaryKey(),
    indexedAt: text('indexed_at').notNull(),
})
