import { HuggingFaceEmbeddingProvider } from '../../mining/embedding-provider.js'
import { mineProject } from '../../mining/mine-project.js'
import type { MineProgressEvent } from '../../mining/progress.js'
import { loadProjectContext } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'
import { confirmInteractive } from '../prompts.js'

type MineOptions = {
    changed?: boolean
    reindex?: boolean
}

export async function repairCommand(options: GlobalCliOptions): Promise<void> {
    await mineCommand(options, { reindex: true })
}

export async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const context = await loadProjectContext(options.project)
    if (mineOptions.changed && mineOptions.reindex) {
        throw new Error('Use either changed or repair mode, not both.')
    }

    const mode = mineOptions.reindex
        ? 'reindex'
        : mineOptions.changed
          ? 'changed'
          : 'full'
    if (
        mode === 'reindex' &&
        !(await confirmInteractive(
            'Repair Konteks memory by rebuilding artifacts for this project?',
            true,
        ))
    ) {
        console.log(
            JSON.stringify(
                {
                    mode: mode === 'reindex' ? 'repair' : mode,
                    ok: false,
                    skipped: true,
                },
                null,
                2,
            ),
        )
        return
    }

    const progress = createMineProgressReporter()
    try {
        const embeddingProvider = new HuggingFaceEmbeddingProvider({
            onProgress: progress.report,
        })
        const result = await mineProject(context, mode, {
            embeddingProvider,
            onProgress: progress.report,
        })

        console.log(
            JSON.stringify(
                {
                    ...result,
                    mode: result.mode === 'reindex' ? 'repair' : result.mode,
                },
                null,
                2,
            ),
        )
    } finally {
        progress.done()
    }
}

export function createMineProgressReporter(): {
    done(): void
    report(event: MineProgressEvent): void
} {
    let activeStep = ''
    let lastInlineLength = 0
    let lastStep = ''
    let spinnerIndex = 0
    let lastCompactMessage = ''
    const downloadBuckets = new Map<string, number>()
    const isTty = process.stderr.isTTY
    const color = createColorPalette(Boolean(isTty && !process.env.NO_COLOR))

    return {
        done() {
            if (isTty && lastInlineLength > 0) {
                process.stderr.write('\n')
            }
        },
        report(event) {
            const message = formatPlainEvent(event)
            if (!message) {
                return
            }

            if (!isTty) {
                const step = stepKey(event)
                const downloadKey = event.downloadFile ?? step
                const downloadBucket =
                    event.downloadPercent === undefined
                        ? undefined
                        : Math.floor(event.downloadPercent / 10)
                const previousDownloadBucket =
                    downloadBuckets.get(downloadKey) ?? -1
                if (
                    event.status !== 'progress' ||
                    step !== lastStep ||
                    (downloadBucket !== undefined &&
                        downloadBucket > previousDownloadBucket)
                ) {
                    console.error(message)
                    lastStep = step
                    if (downloadBucket !== undefined) {
                        downloadBuckets.set(downloadKey, downloadBucket)
                    }
                }
                return
            }

            const step = stepKey(event)
            if (step !== activeStep || event.status === 'start') {
                if (lastInlineLength > 0) {
                    process.stderr.write('\n')
                    lastInlineLength = 0
                }
                activeStep = step
                lastCompactMessage = ''
                process.stderr.write(`${formatStepHeader(event, color)}\n`)
            }

            if (event.status === 'progress') {
                spinnerIndex += 1
                const compact = compactMessage(event)
                const output = formatInlineProgress(event, spinnerIndex, color)
                if (
                    event.stage === 'download' &&
                    compact === lastCompactMessage &&
                    event.downloadPercent === undefined
                ) {
                    return
                }
                const padding = Math.max(
                    0,
                    lastInlineLength - visibleLength(output),
                )
                process.stderr.write(`\r${output}${' '.repeat(padding)}`)
                lastInlineLength = visibleLength(output)
                lastCompactMessage = compact
                return
            }

            if (event.status === 'done' && event.phase !== 'done') {
                if (lastInlineLength > 0) {
                    process.stderr.write('\n')
                    lastInlineLength = 0
                }
                process.stderr.write(`${formatDoneLine(event, color)}\n`)
                return
            }

            if (event.phase === 'done') {
                if (lastInlineLength > 0) {
                    process.stderr.write('\n')
                }
                process.stderr.write(`${formatFinalLine(event, color)}\n`)
                lastInlineLength = 0
            }
        },
    }
}

function formatPlainEvent(event: MineProgressEvent): string {
    const progress = formatPercentAndCount(event)
    return [phaseTitle(event.phase), progress, compactMessage(event)]
        .filter(Boolean)
        .join('  ')
}

function formatStepHeader(
    event: MineProgressEvent,
    color: ColorPalette,
): string {
    return `${color.dim('┌')} ${color.accent(stepTitle(event))}`
}

function formatInlineProgress(
    event: MineProgressEvent,
    spinnerIndex: number,
    color: ColorPalette,
): string {
    const spinner = color.accent(spinnerFrame(spinnerIndex))
    const progress = color.info(formatPercentAndCount(event).padEnd(20))
    const action = compactMessage(event)
    const detail = formatInlineDetail(event)

    return `  ${spinner} ${progress} ${action}${detail ? color.dim(`  ${detail}`) : ''}`
}

function formatDoneLine(event: MineProgressEvent, color: ColorPalette): string {
    return `  ${color.success('✓')} ${event.message ?? `${phaseTitle(event.phase)} done`}`
}

function formatFinalLine(
    event: MineProgressEvent,
    color: ColorPalette,
): string {
    return `${color.success('✓')} ${event.message ?? 'Extraction complete'}`
}

function compactMessage(event: MineProgressEvent): string {
    const message = event.message ?? phaseTitle(event.phase)

    if (event.phase === 'embeddings') {
        if (event.stage === 'download') {
            if (event.downloadPercent !== undefined) {
                return 'Downloading model'
            }
            if (/^Embedding model ready:/u.test(message)) {
                return 'Model ready'
            }
            if (/^Loading embedding model/u.test(message)) {
                return 'Loading downloaded model'
            }
            if (/^Preparing /u.test(message)) {
                return 'Preparing model'
            }
            return message
        }
        if (
            /^Embedded chunk:/u.test(message) ||
            /^Embedding chunk:/u.test(message)
        ) {
            return 'Embedding section'
        }
        if (
            /^Embedded module:/u.test(message) ||
            /^Embedding module:/u.test(message)
        ) {
            return 'Embedding module'
        }
        if (/^Reused embedding for chunk:/u.test(message)) {
            return 'Reusing section embedding'
        }
        if (/^Reused embedding for module:/u.test(message)) {
            return 'Reusing module embedding'
        }
        if (/^Loading embedding model and embedding chunk:/u.test(message)) {
            return 'Loading model, embedding section'
        }
        if (/^Loading embedding model and embedding module:/u.test(message)) {
            return 'Loading model, embedding module'
        }
    }

    if (event.phase === 'chunks' && event.path) {
        return 'Extracting files'
    }

    return message
}

function formatInlineDetail(event: MineProgressEvent): string {
    if (event.phase === 'chunks' && event.path) {
        return ''
    }

    if (
        event.phase === 'embeddings' &&
        event.embeddedCount !== undefined &&
        event.total !== undefined
    ) {
        return `${event.embeddedCount} indexed, ${event.reusedCount ?? 0} unchanged`
    }

    if (event.downloadFile) {
        return event.downloadFile
    }

    return ''
}

function formatPercentAndCount(event: MineProgressEvent): string {
    if (event.downloadPercent !== undefined) {
        return `${event.downloadPercent.toFixed(1).padStart(5)}% ${formatBytes(
            event.downloadLoadedBytes ?? 0,
        )}/${formatBytes(event.downloadTotalBytes ?? 0)}`
    }

    if (event.total !== undefined) {
        const current =
            event.current ?? (event.status === 'done' ? event.total : 0)
        const percent = event.total === 0 ? 100 : (current / event.total) * 100
        return `${Math.round(percent).toString().padStart(3)}% ${current}/${event.total}`
    }

    return ''
}

function phaseTitle(phase: MineProgressEvent['phase']): string {
    const labels: Record<MineProgressEvent['phase'], string> = {
        chunks: 'Extracting files',
        database: 'Database',
        done: 'Complete',
        embeddings: 'Embeddings',
        manifest: 'Manifest',
        metadata: 'Metadata',
        modules: 'Modules',
        scan: 'Scan',
        select: 'Selection',
        start: 'Konteks extraction',
        summary: 'Summary',
    }

    return labels[phase]
}

function stepTitle(event: MineProgressEvent): string {
    if (event.phase === 'embeddings') {
        return event.stage === 'download'
            ? 'Embeddings: Model Download'
            : 'Embeddings: Vector Generation'
    }

    return phaseTitle(event.phase)
}

function stepKey(event: MineProgressEvent): string {
    return `${event.phase}:${event.stage ?? 'default'}`
}

function spinnerFrame(index: number): string {
    return ['◐', '◓', '◑', '◒'][index % 4] ?? '◐'
}

function visibleLength(value: string): number {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '').length
}

type ColorPalette = {
    accent(value: string): string
    dim(value: string): string
    info(value: string): string
    success(value: string): string
}

function createColorPalette(enabled: boolean): ColorPalette {
    const wrap = (code: number, value: string) =>
        enabled ? `\u001b[${code}m${value}\u001b[0m` : value

    return {
        accent: value => wrap(36, value),
        dim: value => wrap(90, value),
        info: value => wrap(34, value),
        success: value => wrap(32, value),
    }
}

function formatBytes(value: number): string {
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
