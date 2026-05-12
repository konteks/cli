import type { CallToolResult } from '@/app/services/mcp'
import { encodeToon } from '@/app/services/serialization'

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
