import { z } from '@/app/support/validation'

export const warmUpInputSchema = z.object({
    maxTokens: z.number().int().min(1).max(8000).optional(),
    topic: z.string().optional(),
})

export type WarmUpInput = z.infer<typeof warmUpInputSchema>

export const recallInputSchema = z.object({
    includeSources: z.boolean().optional(),
    maxTokens: z.number().int().min(1).max(8000).optional(),
    task: z.string().min(1, 'task is required'),
})

export type RecallInput = z.infer<typeof recallInputSchema>

export const searchInputSchema = z.object({
    limit: z.number().int().min(1).max(50).optional(),
    query: z.string().min(1, 'query is required'),
})

export type SearchInput = z.infer<typeof searchInputSchema>

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

export const saveInputSchema = z.discriminatedUnion('type', [
    saveMemorySchema,
    z.object({
        memories: z
            .array(saveMemorySchema)
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

export type SaveInput = z.infer<typeof saveInputSchema>

export const forgetInputSchema = z
    .object({
        id: z.string().optional(),
        mode: z.enum(['hard_delete', 'invalidate', 'soft_delete']).optional(),
        query: z.string().optional(),
        reason: z.string().optional(),
    })
    .refine(data => data.id || data.query, {
        message: 'Either id or query is required.',
    })

export type ForgetInput = z.infer<typeof forgetInputSchema>
