import type { CallToolResult } from '@/services/mcp'
import { encodeToon } from '@/services/serialization'

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
