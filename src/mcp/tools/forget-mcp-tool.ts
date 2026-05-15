import z from 'zod'
import forgetMemory from '@/memory/forget-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
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

type Input = typeof INPUT_SCHEMA._output

export default class ForgetMcpTool extends BaseMcpTool<Input> {
    annotations = {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    description =
        'Delete, invalidate, or suppress stored memory that is wrong, stale, sensitive, or no longer useful.'

    inputSchema = INPUT_SCHEMA

    name = 'konteks_forget' as const

    constructor(private readonly forget: typeof forgetMemory = forgetMemory) {
        super()
    }

    protected override async execute(
        options: StartMcpServerOptions,
        input: Input,
    ) {
        return this.formatOutput(await this.forget(options, input))
    }
}
