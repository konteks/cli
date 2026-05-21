import z from 'zod'
import { openProjectDatabase } from '@/database/actions/_db'
import forgetMemory from '@/database/services/forget-memory'
import { loadMcpProjectContext } from '@/memory/runtime'
import type { ForgetResult } from '@/models/memory'
import BaseMcpTool from './_base-mcp-tool'

const INPUT_SCHEMA = z
    .object({
        id: z.string().optional(),
        mode: z.enum(['hard_delete', 'invalidate', 'soft_delete']).optional(),
        query: z.string().optional(),
        reason: z.string().optional(),
    })
    .refine(data => data.id || data.query, {
        message: 'Either id or query is required.',
    })

type Input = z.output<typeof INPUT_SCHEMA>

export default class ForgetMcpTool extends BaseMcpTool<Input> {
    public readonly annotations = {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    public readonly description =
        'Delete, invalidate, or suppress stored memory that is wrong, stale, sensitive, or no longer useful.'

    public readonly inputSchema = INPUT_SCHEMA

    public readonly name = 'konteks_forget'

    public async handle(input: Input): Promise<ForgetResult> {
        const context = await loadMcpProjectContext()
        const db = await openProjectDatabase(context)
        try {
            return await forgetMemory(db, input)
        } finally {
            await db.close()
        }
    }
}
