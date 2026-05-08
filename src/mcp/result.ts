import { stringifyPretty } from '../utils/json.js'

export function textResult(value: unknown, text?: string) {
    const structuredContent =
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : undefined

    return {
        content: [
            {
                text:
                    text ??
                    (typeof value === 'string'
                        ? value
                        : stringifyPretty(value)),
                type: 'text' as const,
            },
        ],
        structuredContent,
    }
}
