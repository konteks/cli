import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode as encodeToon } from '@toon-format/toon'
import type z from 'zod'
import type { StartMcpServerOptions } from '@/models/mcp'

export type McpToolName =
    | 'konteks_forget'
    | 'konteks_recall'
    | 'konteks_save'
    | 'konteks_search'
    | 'konteks_warm_up'

export default abstract class BaseMcpTool<Input = unknown> {
    public abstract annotations: {
        destructiveHint: boolean
        idempotentHint: boolean
        openWorldHint: boolean
        readOnlyHint: boolean
    }

    public abstract description: string

    public abstract inputSchema: z.ZodType

    public abstract name: McpToolName

    public async handle(
        options: StartMcpServerOptions,
        input: unknown,
    ): Promise<CallToolResult> {
        return await this.execute(options, this.validate(input))
    }

    protected abstract execute(
        options: StartMcpServerOptions,
        input: Input,
    ): Promise<CallToolResult>

    protected validate(input: unknown): Input {
        return this.inputSchema.parse(input) as Input
    }

    protected formatOutput(value: string | object): CallToolResult {
        return {
            content: [
                {
                    text: typeof value === 'string' ? value : encodeToon(value),
                    type: 'text' as const,
                },
            ],
        }
    }
}
