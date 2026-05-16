import z from 'zod'

const memoryKindSchema = z.enum([
    'blocker',
    'code_insight',
    'constraint',
    'decision',
    'fact',
    'note',
    'preference',
])

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}

const saveTextSchema = z
    .string()
    .refine(val => !looksSensitive(val), {
        message: 'content appears to contain a secret',
    })
    .refine(val => val.trim().split(/\s+/u).filter(Boolean).length >= 4, {
        message: 'content is too short to save',
    })

const saveMemorySchema = z.object({
    content: saveTextSchema,
    importance: z
        .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
        ])
        .optional(),
    kind: memoryKindSchema,
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    type: z.literal('memory'),
})

const saveBatchMemorySchema = saveMemorySchema.extend({
    type: z.literal('memory').default('memory'),
})

export const SAVE_PROTOCOL_INPUT_SCHEMA = {
    content: saveTextSchema.optional(),
    importance: z
        .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
        ])
        .optional(),
    kind: memoryKindSchema.optional(),
    memories: z
        .array(saveBatchMemorySchema)
        .min(1, 'memories must contain at least one item')
        .optional(),
    source: z.string().optional(),
    subject: z.string().optional(),
    summary: saveTextSchema.optional(),
    tags: z.array(z.string()).optional(),
    type: z.enum(['memory', 'memories', 'diary']),
} satisfies Record<string, z.ZodTypeAny>

const SAVE_INPUT_SCHEMA = z.discriminatedUnion('type', [
    saveMemorySchema,
    z.object({
        memories: z
            .array(saveBatchMemorySchema)
            .min(1, 'memories must contain at least one item'),
        type: z.literal('memories'),
    }),
    z.object({
        subject: z.string().optional(),
        summary: saveTextSchema,
        tags: z.array(z.string()).optional(),
        type: z.literal('diary'),
    }),
])

export default SAVE_INPUT_SCHEMA
