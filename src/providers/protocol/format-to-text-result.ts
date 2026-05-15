import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode as encodeToon } from '@toon-format/toon'

export default function formatToTextResult(
    value: string | object,
): CallToolResult {
    return {
        content: [
            {
                text: typeof value === 'string' ? value : encodeToon(value),
                type: 'text' as const,
            },
        ],
    }
}
