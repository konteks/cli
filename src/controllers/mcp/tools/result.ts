import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode } from '@toon-format/toon'

export function formatToTextResult(value: string | object): CallToolResult {
    return {
        content: [
            {
                text: typeof value === 'string' ? value : encode(value),
                type: 'text' as const,
            },
        ],
    }
}
