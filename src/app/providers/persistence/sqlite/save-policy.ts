import type {
    SaveInput,
    SaveOptions,
} from '@/app/contracts/repositories/memory-repository'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>

export function summarizeText(content: string): string {
    const normalized = content.trim().replaceAll(/\s+/gu, ' ')
    return normalized.length > 240
        ? `${normalized.slice(0, 237).trimEnd()}...`
        : normalized
}

export function importanceToConfidence(importance: number | undefined): number {
    return importance ? importance / 5 : 1
}

export function validateMemoryQuality(content: string): void {
    const normalized = content.trim()
    if (looksSensitive(normalized)) {
        throw new Error('memory content appears to contain a secret')
    }
    if (normalized.split(/\s+/u).filter(Boolean).length < 4) {
        throw new Error('memory content is too short to save')
    }
}

export function validateSessionQuality(summary: string): void {
    if (summary.trim().split(/\s+/u).filter(Boolean).length < 4) {
        throw new Error('session summary is too short to save')
    }
}

export function withProjectUpdateSummary(
    input: Extract<SaveInput, { type: 'diary' }>,
    projectUpdate: SaveProjectUpdate | undefined,
): Extract<SaveInput, { type: 'diary' }> {
    const projectSummary = summarizeProjectUpdate(projectUpdate)
    if (!projectSummary) {
        return input
    }

    return {
        ...input,
        summary: `${input.summary}\n${projectSummary}`,
    }
}

export function isSkippableMemoryError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.message.includes('too short') ||
            error.message.includes('secret'))
    )
}

function summarizeProjectUpdate(
    projectUpdate: SaveProjectUpdate | undefined,
): string {
    if (!projectUpdate) {
        return ''
    }

    const updated = projectUpdate.updatedFilePaths.slice(0, 8)
    const deleted = projectUpdate.deletedFilePaths.slice(0, 8)
    const lines: string[] = []

    if (updated.length > 0) {
        lines.push(`Updated project files considered: ${updated.join(', ')}`)
    }
    if (deleted.length > 0) {
        lines.push(`Deleted project files considered: ${deleted.join(', ')}`)
    }

    return lines.join('\n')
}

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}
