import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import { encode as encodeToonVendor } from '@toon-format/toon'

type Jsonish =
    | boolean
    | number
    | string
    | null
    | Jsonish[]
    | { [key: string]: Jsonish | undefined }

export default function toCallToolResult(
    value: object | string,
): CallToolResult {
    const text =
        typeof value === 'string'
            ? value
            : encodeToonVendor(
                  compactObject(value as Record<string, unknown>) ?? {},
              )

    return {
        content: [
            {
                text: text,
                type: 'text' as const,
            },
        ],
    }
}

function compactValue(value: unknown): Jsonish | undefined {
    if (value === undefined) {
        return undefined
    }

    if (Array.isArray(value)) {
        const items = value
            .map(item => compactValue(item))
            .filter((item): item is Jsonish => item !== undefined)

        return items.length > 0 ? items : undefined
    }

    if (value && typeof value === 'object') {
        return compactObject(value as Record<string, unknown>)
    }

    return value as Jsonish
}

function compactObject(
    value: Record<string, unknown>,
): Record<string, Jsonish> | undefined {
    const output: Record<string, Jsonish> = {}

    for (const [key, item] of Object.entries(value)) {
        const compacted = compactValue(item)
        if (compacted !== undefined) {
            output[key] = compacted
        }
    }

    return Object.keys(output).length > 0 ? output : undefined
}
