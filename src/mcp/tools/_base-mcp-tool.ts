import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode as encodeToon } from '@toon-format/toon'
import type z from 'zod'
import type { StartMcpServerOptions } from '@/models/mcp'

type McpRegistrationInputSchema = Record<string, z.ZodTypeAny> | z.ZodType

export default abstract class BaseMcpTool {
    public abstract readonly annotations: {
        destructiveHint: boolean
        idempotentHint: boolean
        openWorldHint: boolean
        readOnlyHint: boolean
    }

    public abstract readonly description: string

    protected abstract readonly inputSchema: z.ZodType

    public abstract readonly name: string

    public get registrationInputSchema(): McpRegistrationInputSchema {
        return this.inputSchema
    }

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
        input: z.output<typeof this.inputSchema>,
    ): Promise<string | object>

    private validate(input: unknown): z.output<typeof this.inputSchema> {
        return this.inputSchema.parse(input)
    }
}
