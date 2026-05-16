import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode as encodeToon } from '@toon-format/toon'
import z from 'zod'
import type { StartMcpServerOptions } from '@/models/mcp'

export type McpInputSchema = Record<string, z.ZodTypeAny> | z.ZodType

export default abstract class BaseMcpTool<Input = unknown> {
    public abstract readonly annotations: {
        destructiveHint: boolean
        idempotentHint: boolean
        openWorldHint: boolean
        readOnlyHint: boolean
    }

    public abstract readonly description: string

    public abstract readonly inputSchema: McpInputSchema

    public abstract readonly name: string

    private formatOutput(value: string | object): CallToolResult {
        return {
            content: [
                {
                    text: typeof value === 'string' ? value : encodeToon(value),
                    type: 'text' as const,
                },
            ],
        }
    }

    public async handle(
        options: StartMcpServerOptions,
        input: unknown,
    ): Promise<CallToolResult> {
        const formattedInput = this.validate(input)
        const result = await this.coreHandle(options, formattedInput)
        return this.formatOutput(result)
    }

    protected abstract coreHandle(
        options: StartMcpServerOptions,
        input: Input,
    ): Promise<string | object>

    private validate(input: unknown): Input {
        if (this.inputSchema instanceof z.ZodType) {
            return this.inputSchema.parse(input) as Input
        }

        return z.object(this.inputSchema).parse(input) as Input
    }
}
