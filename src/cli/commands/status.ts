import { getProjectStatus } from '../../project/status.js'
import type { GlobalCliOptions } from '../options.js'

export async function statusCommand(options: GlobalCliOptions): Promise<void> {
    const status = await getProjectStatus(options.project)
    console.log(
        formatStatus(status, {
            color: createColorPalette(
                Boolean(process.stdout.isTTY && !process.env.NO_COLOR),
            ),
        }),
    )
}

type ProjectStatus = Awaited<ReturnType<typeof getProjectStatus>>
type StatusColorPalette = {
    accent(value: string): string
    danger(value: string): string
    dim(value: string): string
    success(value: string): string
    warning(value: string): string
}

export function formatStatus(
    status: ProjectStatus,
    options: { color?: StatusColorPalette } = {},
): string {
    const color = options.color ?? createColorPalette(false)
    const freshness = status.freshness.status
    const separator = color.dim('─'.repeat(48))
    const title =
        freshness === 'fresh'
            ? color.success('Konteks Status')
            : freshness === 'stale'
              ? color.warning('Konteks Status')
              : color.danger('Konteks Status')
    const lines = [
        '',
        title,
        separator,
        row('Project', status.projectRoot),
        row('Memory', status.memoryDir),
        ...(status.freshness.lastExtractedAt
            ? [
                  row(
                      'Last extracted',
                      formatDate(status.freshness.lastExtractedAt),
                  ),
              ]
            : []),
        '',
        color.accent('Memory Stats'),
        separator,
        statRow('Sections', status.memoryStats.sections),
        statRow('Modules', status.memoryStats.modules),
        statRow('Memories', status.memoryStats.memories),
        statRow('Diary entries', status.memoryStats.diaryEntries),
        statRow('Retrieval docs', status.memoryStats.retrievalDocuments),
        statRow('Embeddings', status.memoryStats.embeddings),
        statRow('Events', status.memoryStats.events),
        '',
    ]

    return lines.join('\n')
}

function row(label: string, value: string): string {
    return `${label.padEnd(14)} ${value}`
}

function statRow(label: string, value: number): string {
    return row(label, value.toLocaleString('en-US'))
}

function formatDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}

function createColorPalette(enabled: boolean): StatusColorPalette {
    const wrap = (code: number, value: string) =>
        enabled ? `\u001b[${code}m${value}\u001b[0m` : value

    return {
        accent: value => wrap(36, value),
        danger: value => wrap(31, value),
        dim: value => wrap(90, value),
        success: value => wrap(32, value),
        warning: value => wrap(33, value),
    }
}
