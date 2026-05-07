type UnknownRecord = Record<string, unknown>

type PrimitiveSchema = {
    enum?: string[]
    items?: unknown
    maximum?: number
    minimum?: number
    properties?: Record<string, unknown>
    type: 'boolean' | 'integer' | 'string'
    required?: string[]
}

type ObjectSchema = {
    additionalProperties?: boolean
    properties: Record<string, PrimitiveSchema>
    required?: string[]
    type: 'object'
}

export const emptyInputSchema = {
    additionalProperties: false,
    properties: {},
    type: 'object',
} satisfies ObjectSchema

export const warmUpInputSchema = {
    additionalProperties: false,
    properties: {
        includeCommands: { type: 'boolean' },
        includeOpenTasks: { type: 'boolean' },
        includeRecentSessions: { type: 'boolean' },
        maxTokens: { maximum: 8000, minimum: 1, type: 'integer' },
    },
    type: 'object',
} satisfies ObjectSchema

export const recallInputSchema = {
    additionalProperties: false,
    properties: {
        includeSources: { type: 'boolean' },
        maxTokens: { maximum: 8000, minimum: 1, type: 'integer' },
        task: { type: 'string' },
    },
    required: ['task'],
    type: 'object',
} satisfies ObjectSchema

export const searchInputSchema = {
    additionalProperties: false,
    properties: {
        limit: { maximum: 50, minimum: 1, type: 'integer' },
        query: { type: 'string' },
    },
    required: ['query'],
    type: 'object',
} satisfies ObjectSchema

export const saveInputSchema = {
    additionalProperties: false,
    properties: {
        content: {
            description: 'Memory content when type is "memory".',
            type: 'string',
        },
        importance: {
            description: 'Optional memory importance from 1 to 5.',
            maximum: 5,
            minimum: 1,
            type: 'integer',
        },
        kind: {
            description: 'Durable memory kind when type is "memory".',
            enum: [
                'blocker',
                'code_insight',
                'constraint',
                'decision',
                'fact',
                'note',
                'preference',
            ],
            type: 'string',
        },
        memories: {
            description:
                'Durable memory items when type is "memories". Use this for the first save phase.',
            items: {
                additionalProperties: false,
                properties: {
                    content: { type: 'string' },
                    importance: { maximum: 5, minimum: 1, type: 'integer' },
                    kind: {
                        enum: [
                            'blocker',
                            'code_insight',
                            'constraint',
                            'decision',
                            'fact',
                            'note',
                            'preference',
                        ],
                        type: 'string',
                    },
                    source: { type: 'string' },
                    tags: { items: { type: 'string' }, type: 'array' },
                },
                required: ['kind', 'content'],
                type: 'object',
            },
            type: 'array',
        },
        source: {
            description: 'Optional memory source label.',
            type: 'string',
        },
        subject: {
            description: 'Diary subject when type is "diary".',
            type: 'string',
        },
        summary: {
            description: 'Diary summary when type is "diary".',
            type: 'string',
        },
        tags: {
            description: 'Optional tags for memory or diary entries.',
            items: { type: 'string' },
            type: 'array',
        },
        type: {
            description:
                'Save mode. Use "memories" for durable memory batch, then "diary" for the session diary.',
            enum: ['memory', 'memories', 'diary'],
            type: 'string',
        },
    },
    required: ['type'] as string[],
    type: 'object' as const,
}

export const forgetInputSchema = {
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        mode: {
            enum: ['hard_delete', 'invalidate', 'soft_delete'],
            type: 'string',
        },
        query: { type: 'string' },
        reason: { type: 'string' },
    },
    type: 'object',
} satisfies ObjectSchema

type WarmUpInput = {
    includeCommands?: boolean
    includeOpenTasks?: boolean
    includeRecentSessions?: boolean
    maxTokens?: number
}

export type ForgetInput = {
    id?: string
    mode?: 'hard_delete' | 'invalidate' | 'soft_delete'
    query?: string
    reason?: string
}

export type RecallInput = {
    includeSources?: boolean
    maxTokens?: number
    task: string
}

type MemoryKind =
    | 'blocker'
    | 'code_insight'
    | 'constraint'
    | 'decision'
    | 'fact'
    | 'note'
    | 'preference'

type SaveMemoryInput = {
    content: string
    importance?: 1 | 2 | 3 | 4 | 5
    kind: MemoryKind
    source?: string
    tags?: string[]
    type: 'memory'
}

export type SaveInput =
    | SaveMemoryInput
    | {
          memories: SaveMemoryInput[]
          type: 'memories'
      }
    | {
          subject?: string
          summary: string
          tags?: string[]
          type: 'diary'
      }

export type SearchInput = {
    limit?: number
    query: string
}

export function parseWarmUpInput(input: unknown): WarmUpInput {
    const record = asRecord(input)
    return {
        includeCommands: optionalBoolean(
            record.includeCommands,
            'includeCommands',
        ),
        includeOpenTasks: optionalBoolean(
            record.includeOpenTasks,
            'includeOpenTasks',
        ),
        includeRecentSessions: optionalBoolean(
            record.includeRecentSessions,
            'includeRecentSessions',
        ),
        maxTokens: optionalPositiveInteger(record.maxTokens, 'maxTokens', 8000),
    }
}

export function parseRecallInput(input: unknown): RecallInput {
    const record = asRecord(input)
    return {
        includeSources: optionalBoolean(
            record.includeSources,
            'includeSources',
        ),
        maxTokens: optionalPositiveInteger(record.maxTokens, 'maxTokens', 8000),
        task: requiredString(record.task, 'task'),
    }
}

export function parseSearchInput(input: unknown): SearchInput {
    const record = asRecord(input)
    return {
        limit: optionalPositiveInteger(record.limit, 'limit', 50),
        query: requiredString(record.query, 'query'),
    }
}

export function parseSaveInput(input: unknown): SaveInput {
    const record = asRecord(input)
    const type = requiredString(record.type, 'type')

    if (type === 'memory') {
        return parseMemoryInput(record)
    }

    if (type === 'memories') {
        const memories = requiredArray(record.memories, 'memories').map(
            (item, index) =>
                parseMemoryInput(asRecordField(item, `memories[${index}]`)),
        )
        if (memories.length === 0) {
            throw new Error('memories must contain at least one item')
        }

        return {
            memories,
            type: 'memories',
        }
    }

    if (type === 'diary') {
        const summary = requiredString(record.summary, 'summary')
        validateSaveText(summary, 'diary summary')
        return {
            subject: optionalString(record.subject, 'subject'),
            summary,
            tags: optionalStringArray(record.tags, 'tags'),
            type: 'diary',
        }
    }

    throw new Error('type must be "memory", "memories", or "diary"')
}

export function parseForgetInput(input: unknown): ForgetInput {
    const record = asRecord(input)
    const parsed = {
        id: optionalString(record.id, 'id'),
        mode: parseForgetMode(record.mode),
        query: optionalString(record.query, 'query'),
        reason: optionalString(record.reason, 'reason'),
    }

    if (!parsed.id && !parsed.query) {
        throw new Error('Either id or query is required.')
    }

    return parsed
}

function asRecord(input: unknown): UnknownRecord {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Input must be an object')
    }

    return input as UnknownRecord
}

function asRecordField(input: unknown, field: string): UnknownRecord {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error(`${field} must be an object`)
    }

    return input as UnknownRecord
}

function requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${field} is required`)
    }

    return value
}

function optionalString(value: unknown, field: string): string | undefined {
    if (value === undefined) {
        return undefined
    }

    return requiredString(value, field)
}

function optionalStringArray(
    value: unknown,
    field: string,
): string[] | undefined {
    if (value === undefined) {
        return undefined
    }

    return requiredArray(value, field).map((item, index) =>
        requiredString(item, `${field}[${index}]`),
    )
}

function requiredArray(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) {
        throw new Error(`${field} must be an array`)
    }

    return value
}

function parseMemoryInput(record: UnknownRecord): SaveMemoryInput {
    const content = requiredString(record.content, 'content')
    validateSaveText(content, 'memory content')

    return {
        content,
        importance: optionalImportance(record.importance, 'importance'),
        kind: parseMemoryKind(record.kind),
        source: optionalString(record.source, 'source'),
        tags: optionalStringArray(record.tags, 'tags'),
        type: 'memory',
    }
}

function validateSaveText(content: string, label: string): void {
    if (looksSensitive(content)) {
        throw new Error(`${label} appears to contain a secret`)
    }
    if (content.trim().split(/\s+/u).filter(Boolean).length < 4) {
        throw new Error(`${label} is too short to save`)
    }
}

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}

function parseMemoryKind(value: unknown): MemoryKind {
    const kind = requiredString(value, 'kind')
    if (
        [
            'blocker',
            'code_insight',
            'constraint',
            'decision',
            'fact',
            'note',
            'preference',
        ].includes(kind)
    ) {
        return kind as MemoryKind
    }

    throw new Error(
        'kind must be "blocker", "code_insight", "constraint", "decision", "fact", "note", or "preference"',
    )
}

function optionalImportance(
    value: unknown,
    field: string,
): 1 | 2 | 3 | 4 | 5 | undefined {
    return optionalPositiveInteger(value, field, 5) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | undefined
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined) {
        return undefined
    }

    if (typeof value !== 'boolean') {
        throw new Error(`${field} must be a boolean`)
    }

    return value
}

function optionalPositiveInteger(
    value: unknown,
    field: string,
    max: number,
): number | undefined {
    if (value === undefined) {
        return undefined
    }

    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > max
    ) {
        throw new Error(`${field} must be an integer between 1 and ${max}`)
    }

    return value
}

function parseForgetMode(
    value: unknown,
): 'hard_delete' | 'invalidate' | 'soft_delete' | undefined {
    if (value === undefined) {
        return undefined
    }

    const mode = requiredString(value, 'mode')
    if (['hard_delete', 'invalidate', 'soft_delete'].includes(mode)) {
        return mode as 'hard_delete' | 'invalidate' | 'soft_delete'
    }

    throw new Error(
        'mode must be "soft_delete", "invalidate", or "hard_delete"',
    )
}
