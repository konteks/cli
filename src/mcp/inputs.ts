type UnknownRecord = Record<string, unknown>

type PrimitiveSchema = {
    enum?: string[]
    maximum?: number
    minimum?: number
    type: 'boolean' | 'integer' | 'string'
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
    additionalProperties: true,
    properties: {
        type: {
            enum: ['memory', 'session'],
            type: 'string',
        },
    },
    required: ['type'],
    type: 'object',
} satisfies ObjectSchema

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

type MemoryKind =
    | 'blocker'
    | 'code_insight'
    | 'decision'
    | 'fact'
    | 'note'
    | 'preference'

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

export type SaveInput =
    | {
          content: string
          entities?: string[]
          importance?: 1 | 2 | 3 | 4 | 5
          kind: MemoryKind
          source?: string
          tags?: string[]
          type: 'memory'
      }
    | {
          blockers?: string[]
          decisions?: string[]
          entities?: string[]
          filesTouched?: string[]
          nextSteps?: string[]
          openQuestions?: string[]
          status: 'blocked' | 'done' | 'partial'
          summary: string
          task: string
          testsRun?: string[]
          type: 'session'
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
        return {
            content: requiredString(record.content, 'content'),
            entities: optionalStringArray(record.entities, 'entities'),
            importance: optionalImportance(record.importance),
            kind: parseMemoryKind(record.kind),
            source: optionalString(record.source, 'source'),
            tags: optionalStringArray(record.tags, 'tags'),
            type,
        }
    }

    if (type === 'session') {
        return {
            blockers: optionalStringArray(record.blockers, 'blockers'),
            decisions: optionalStringArray(record.decisions, 'decisions'),
            entities: optionalStringArray(record.entities, 'entities'),
            filesTouched: optionalStringArray(
                record.filesTouched,
                'filesTouched',
            ),
            nextSteps: optionalStringArray(record.nextSteps, 'nextSteps'),
            openQuestions: optionalStringArray(
                record.openQuestions,
                'openQuestions',
            ),
            status: parseSessionStatus(record.status),
            summary: requiredString(record.summary, 'summary'),
            task: requiredString(record.task, 'task'),
            testsRun: optionalStringArray(record.testsRun, 'testsRun'),
            type,
        }
    }

    throw new Error('type must be "memory" or "session"')
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

function optionalStringArray(
    value: unknown,
    field: string,
): string[] | undefined {
    if (value === undefined) {
        return undefined
    }

    if (
        !Array.isArray(value) ||
        value.some(item => typeof item !== 'string' || item.trim() === '')
    ) {
        throw new Error(`${field} must be an array of non-empty strings`)
    }

    return value
}

function optionalImportance(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
    if (value === undefined) {
        return undefined
    }

    if ([1, 2, 3, 4, 5].includes(value as number)) {
        return value as 1 | 2 | 3 | 4 | 5
    }

    throw new Error('importance must be an integer from 1 to 5')
}

function parseMemoryKind(value: unknown): MemoryKind {
    const kind = requiredString(value, 'kind')
    if (
        [
            'blocker',
            'code_insight',
            'decision',
            'fact',
            'note',
            'preference',
        ].includes(kind)
    ) {
        return kind as MemoryKind
    }

    throw new Error('kind is not supported')
}

function parseSessionStatus(value: unknown): 'blocked' | 'done' | 'partial' {
    const status = requiredString(value, 'status')
    if (['blocked', 'done', 'partial'].includes(status)) {
        return status as 'blocked' | 'done' | 'partial'
    }

    throw new Error('status must be "done", "partial", or "blocked"')
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
