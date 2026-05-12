import type { CallToolResult } from '@/app/support/mcp'
import { encodeToon } from '@/app/support/serialization'

export function formatToTextResult(value: string | object): CallToolResult {
    return {
        content: [
            {
                text: typeof value === 'string' ? value : encodeToon(value),
                type: 'text' as const,
            },
        ],
    }
}
