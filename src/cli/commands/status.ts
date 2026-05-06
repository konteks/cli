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
    dim(value: string): string
}

export function formatStatus(
    status: ProjectStatus,
    options: { color?: StatusColorPalette } = {},
): string {
    const color = options.color ?? createColorPalette(false)
    const separator = color.dim('─'.repeat(48))
    const changedFiles = status.freshness.changedFileCount
    const lines = [
        '',
        color.accent('Konteks Memory'),
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
        row(
            'Session update',
            changedFiles > 0
                ? `${formatCount(changedFiles, 'file')} changed since then`
                : 'No file changes since last extraction',
        ),
        '',
        color.accent('Knowledge'),
        separator,
        statRow('Sections', status.memoryStats.sections),
        statRow('Modules', status.memoryStats.modules),
        '',
        color.accent('Session Memory'),
        separator,
        statRow('Memories', status.memoryStats.memories),
        statRow('Diary entries', status.memoryStats.diaryEntries),
        statRow('Events', status.memoryStats.events),
        '',
        color.accent('Retrieval'),
        separator,
        statRow('Retrieval docs', status.memoryStats.retrievalDocuments),
        statRow('Embeddings', status.memoryStats.embeddings),
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

function formatCount(value: number, singular: string): string {
    return `${value.toLocaleString('en-US')} ${singular}${value === 1 ? '' : 's'}`
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
        dim: value => wrap(90, value),
    }
}
