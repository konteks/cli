import type { MineProgressEvent } from '@/app/providers/mining/engine/progress'
import {
    type ColorPalette,
    createColorPalette,
} from '@/app/support/color-palette'
import { formatBytes } from '@/app/support/format'
import { terminal } from '@/app/support/terminal'

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
    const isTty = terminal.stderrIsInteractive()
    const color = createColorPalette(terminal.stderrSupportsColor())

    return {
        done() {
            if (isTty && lastInlineLength > 0) {
                terminal.writeError('\n')
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
                    terminal.error(message)
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
                    terminal.writeError('\n')
                    lastInlineLength = 0
                }
                activeStep = step
                lastCompactMessage = ''
                terminal.writeError(`${formatStepHeader(event, color)}\n`)
            }

            if (event.status === 'progress') {
                spinnerIndex += 1
                const compact = compactMessage(event)
                const output = formatInlineProgress(event, spinnerIndex, color)
                if (
                    event.phase === 'preparation' &&
                    compact === lastCompactMessage &&
                    event.downloadPercent === undefined
                ) {
                    return
                }
                const padding = Math.max(
                    0,
                    lastInlineLength - visibleLength(output),
                )
                terminal.writeError(`\r${output}${' '.repeat(padding)}`)
                lastInlineLength = visibleLength(output)
                lastCompactMessage = compact
                return
            }

            if (event.status === 'done' && event.phase !== 'done') {
                if (lastInlineLength > 0) {
                    terminal.writeError('\n')
                    lastInlineLength = 0
                }
                terminal.writeError(`${formatDoneLine(event, color)}\n`)
                return
            }

            if (event.phase === 'done') {
                if (lastInlineLength > 0) {
                    terminal.writeError('\n')
                }
                terminal.writeError(`${formatFinalLine(event, color)}\n`)
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

    if (event.phase === 'preparation') {
        if (event.downloadPercent !== undefined) {
            return 'Loading model files'
        }
        if (/^Embedding model ready:/u.test(message)) {
            return 'Model ready'
        }
        if (/^Loading embedding model/u.test(message)) {
            return 'Loading model'
        }
        if (/^Preparing /u.test(message)) {
            return 'Preparing model'
        }
        if (/^Loading /u.test(message)) {
            return 'Loading model files'
        }
        return message
    }

    if (event.phase === 'embeddings') {
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
        preparation: 'Preparation',
        scan: 'Scan',
        select: 'Selection',
        start: 'Konteks extraction',
        summary: 'Summary',
    }

    return labels[phase]
}

function stepTitle(event: MineProgressEvent): string {
    if (event.phase === 'preparation') {
        return 'Preparation: Model Load'
    }

    if (event.phase === 'embeddings') {
        return 'Embeddings: Vector Generation'
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
