import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import z from 'zod'
import { createMcpToolErrorResult } from '@/entrypoints/mcp/error-handling'
import toCallToolResult from './_support/to-call-tool-result'

export default abstract class BaseMcpTool<Input = unknown> {
    public abstract readonly annotations: {
        destructiveHint: boolean
        idempotentHint: boolean
        openWorldHint: boolean
        readOnlyHint: boolean
    }

    public abstract readonly description: string

    public abstract readonly inputSchema: z.ZodObject

    public abstract readonly name: string

    public abstract handle(input: Input): Promise<string | object>

    public register(server: McpServer): void {
        server.registerTool(
            this.name,
            {
                annotations: this.annotations,
                description: this.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: this.inputSchema as any,
            },
            async (input: unknown): Promise<CallToolResult> => {
                try {
                    const formattedInput = this.validate(input)
                    const result = await this.handle(formattedInput)

                    return toCallToolResult(result)
                } catch (error) {
                    return createMcpToolErrorResult({
                        error,
                        toolName: this.name,
                    })
                }
            },
        )
    }

    private validate(input: unknown): Input {
        if (this.inputSchema instanceof z.ZodType) {
            return this.inputSchema.parse(input) as Input
        }

        return z.object(this.inputSchema).parse(input) as Input
    }
}
