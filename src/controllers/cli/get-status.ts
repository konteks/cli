import type { GlobalCliOptions } from '@/dto/options'
import { getProjectStatus } from '@/infrastructure/file-system/status'
import { formatInteger, terminal, VERSION } from '@/services'
import { type ColorPalette, createColorPalette } from '@/services/color-palette'

export async function getStatusCommand(
    options: GlobalCliOptions,
): Promise<void> {
    const status = await getProjectStatus(options.project)
    terminal.log(
        formatStatus(status, {
            color: createColorPalette(terminal.stdoutSupportsColor()),
            version: VERSION,
        }),
    )
}

type ProjectStatus = Awaited<ReturnType<typeof getProjectStatus>>
type StatusColorPalette = Pick<ColorPalette, 'accent' | 'dim' | 'success'>

export function formatStatus(
    status: ProjectStatus,
    options: { color?: StatusColorPalette; version?: string } = {},
): string {
    const color = options.color ?? createColorPalette(false)
    const changedFiles = status.freshness.changedFileCount
    const version = options.version ?? VERSION
    const lines = [
        '',
        `${color.accent('Konteks Memory')} ${color.dim(`v${version}`)}`,
        color.dim('─'.repeat(48)),
        row('Project', status.projectRoot),
        row('Memory', status.memoryDir),
        row('Freshness', formatFreshness(status, changedFiles)),
        '',
        anchoredStat(
            color,
            'Knowledge',
            [
                compactStat('sections', status.memoryStats.sections, color),
                compactStat('modules', status.memoryStats.modules, color),
            ].join(', '),
        ),
        anchoredStat(
            color,
            'Session Memory',
            [
                compactStat('memories', status.memoryStats.memories, color),
                compactStat(
                    'diary entries',
                    status.memoryStats.diaryEntries,
                    color,
                ),
            ].join(', '),
        ),
        anchoredStat(
            color,
            'Retrieval',
            [
                compactStat(
                    'documents',
                    status.memoryStats.retrievalDocuments,
                    color,
                ),
                compactStat('vectors', status.memoryStats.embeddings, color),
            ].join(', '),
        ),
        '',
    ]

    return lines.join('\n')
}

function row(label: string, value: string): string {
    return `${label.padEnd(10)} ${value}`
}

function anchoredStat(
    color: StatusColorPalette,
    label: string,
    value: string,
): string {
    return `${color.accent(label.padEnd(14))} ${value}`
}

function compactStat(
    label: string,
    value: number,
    color: StatusColorPalette,
): string {
    return `${color.success(formatInteger(value))} ${label}`
}

function formatCount(value: number, singular: string): string {
    return `${formatInteger(value)} ${singular}${value === 1 ? '' : 's'}`
}

function formatFreshness(status: ProjectStatus, changedFiles: number): string {
    if (status.freshness.status === 'missing') {
        const recommendation = status.freshness.recommendedCommand
            ? `; run ${status.freshness.recommendedCommand}`
            : ''
        return `${status.freshness.reason}${recommendation}`
    }

    const lastExtracted = status.freshness.lastExtractedAt
        ? formatDate(status.freshness.lastExtractedAt)
        : 'Not extracted yet'

    if (changedFiles > 0) {
        return `${lastExtracted}; ${formatCount(changedFiles, 'file')} changed; indexed during warm up/save`
    }

    return `${lastExtracted}; no file changes`
}

function formatDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}
