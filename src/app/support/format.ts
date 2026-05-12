export function formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
        return '0 B'
    }

    const units = ['B', 'KB', 'MB', 'GB']
    let size = value
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex += 1
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatInteger(value: number): string {
    return value.toLocaleString('en-US')
}

export function estimateTextTokens(text: string): number {
    return Math.ceil(text.trim().split(/\s+/u).filter(Boolean).length * 1.33)
}

export function estimateCharacterTokens(values: string[]): number {
    return values.reduce(
        (total, value) => total + Math.max(1, Math.ceil(value.length / 4)),
        0,
    )
}
