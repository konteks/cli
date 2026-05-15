import { isRecord, parseJsonInput } from '@/support/cli/print-json'

export default function parsePromptArguments(
    name: string,
    input?: string,
): Record<string, string> {
    const trimmed = input?.trim()
    if (!trimmed) {
        return {}
    }

    if (name === 'konteks-warm-up' && !looksLikeJson(trimmed)) {
        return { topic: trimmed }
    }

    const parsed = parseJsonInput(trimmed)
    if (!isRecord(parsed)) {
        throw new Error('Prompt arguments must be a JSON object.')
    }

    const args: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
            throw new Error(`Prompt argument "${key}" must be a string.`)
        }
        args[key] = value
    }

    return args
}

function looksLikeJson(value: string): boolean {
    return value.startsWith('{') || value.startsWith('[')
}
