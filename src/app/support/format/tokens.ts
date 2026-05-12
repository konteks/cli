export function estimateTextTokens(text: string): number {
    return Math.ceil(text.trim().split(/\s+/u).filter(Boolean).length * 1.33)
}

export function estimateCharacterTokens(values: string[]): number {
    return values.reduce(
        (total, value) => total + Math.max(1, Math.ceil(value.length / 4)),
        0,
    )
}
