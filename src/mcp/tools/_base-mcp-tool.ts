import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode as encodeToon } from '@toon-format/toon'
import z from 'zod'
import { createMcpToolErrorResult } from '@/mcp/error-handling'

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

    public async handle(input: unknown): Promise<CallToolResult> {
        try {
            const formattedInput = this.validate(input)
            const result = await this.coreHandle(formattedInput)
            return this.formatOutput(result)
        } catch (error) {
            return createMcpToolErrorResult({
                error,
                toolName: this.name,
            })
        }
    }

    protected abstract coreHandle(input: Input): Promise<string | object>

    private validate(input: unknown): Input {
        if (this.inputSchema instanceof z.ZodType) {
            return this.inputSchema.parse(input) as Input
        }

        return z.object(this.inputSchema).parse(input) as Input
    }
}
