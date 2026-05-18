import type { ExtractionProgressEvent } from '@/contracts/services/progress'
import type { ExtractProjectResponse } from '@/models/extraction'
import createColorPalette from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'

type InitProgressReporter = {
    done(): void
    report(event: ExtractionProgressEvent): void
    summary(result: ExtractProjectResponse): void
}

export default function createInitProgressReporter(): InitProgressReporter {
    let printedDocumentLine = false
    let printedPreparation = false
    let generatedSummary = false
    let fileCount = 0
    let sectionCount = 0
    let spinnerIndex = 0
    let lastInlineLength = 0
    let modelPercent: number | undefined
    const color = createColorPalette(terminal.stderrSupportsColor())

    return {
        done() {
            endInlineProgress()
        },
        report(event) {
            if (event.phase === 'preparation') {
                printPreparation(event)
                return
            }

            if (event.phase === 'chunks' && event.status === 'done') {
                finishPreparation()
                sectionCount = event.chunkCount ?? 0
                fileCount = event.current ?? event.total ?? 0
                return
            }

            if (
                event.phase === 'embeddings' &&
                event.stage === 'embed' &&
                event.status === 'start'
            ) {
                printEmbeddingStart(event.total ?? 0)
                return
            }

            if (
                event.phase === 'embeddings' &&
                event.stage === 'embed' &&
                event.status === 'progress'
            ) {
                printVectorProgress(event)
                return
            }

            if (event.phase === 'embeddings' && event.status === 'done') {
                printVectorProgress({
                    ...event,
                    current: event.total,
                })
                return
            }

            if (event.phase === 'summary' && event.status === 'done') {
                generatedSummary = true
                endInlineProgress()
            }
        },
        summary(result) {
            endInlineProgress()
            if (!printedDocumentLine) {
                sectionCount = result.chunkCount
                fileCount = result.fileCount
                printCheck(preparedDocumentsMessage(result.vectorCount))
            }
            if (generatedSummary || result.summaryRef) {
                printCheck('Generated project summary')
            }

            terminal.log('')
            terminal.log(sectionTitle('Project memory ready'))
            terminal.log('')
            printStat('Files indexed', result.fileCount)
            printStat('Sections extracted', result.chunkCount)
            printStat('Vectors indexed', result.vectorCount)
        },
    }

    function printVectorProgress(event: ExtractionProgressEvent): void {
        const current = event.current ?? 0
        const total = event.total ?? current
        const message = `${formatCount(current)}/${formatCount(total)} vectors indexed`

        if (current === total) {
            writeInline(checkLine(message))
            return
        }

        writeProgress(message)
    }

    function printPreparation(event: ExtractionProgressEvent): void {
        if (!event.message) {
            return
        }

        if (isModelReadyEvent(event)) {
            finishPreparation()
            return
        }

        if (event.status === 'done') {
            printCombinedPreparation()
            return
        }

        if (event.stage === 'prepare' && event.downloadPercent !== undefined) {
            modelPercent = event.downloadPercent
        }

        printCombinedPreparation()
    }

    function printCombinedPreparation(): void {
        if (printedPreparation) {
            return
        }

        printInlineProgress(preparationMessage())
    }

    function preparationMessage(): string {
        if (modelPercent === undefined) {
            return `Preparing dependencies: ${spinnerFrame(spinnerIndex)}`
        }

        return `Preparing dependencies: ${color.accent(modelPercent.toFixed(1))}%`
    }

    function printInlineProgress(message: string): void {
        writeProgress(message)
    }

    function writeProgress(message: string): void {
        writeInline(progressLine(message))
        spinnerIndex += 1
    }

    function writeInline(output: string): void {
        const outputLength = visibleLength(output)
        const padding = Math.max(0, lastInlineLength - outputLength)
        terminal.writeError(`\r${output}${' '.repeat(padding)}`)
        lastInlineLength = outputLength
    }

    function endInlineProgress(): void {
        if (lastInlineLength === 0) {
            return
        }

        terminal.writeError('\n')
        lastInlineLength = 0
    }

    function printCheck(message: string): void {
        terminal.log(`${color.success('✓')} ${message}`)
    }

    function finishPreparation(): void {
        if (printedPreparation) {
            return
        }

        printedPreparation = true
        completeInlineProgress(
            `Preparing dependencies: ${color.accent('100')}%`,
        )
    }

    function printEmbeddingStart(documentCount: number): void {
        finishPreparation()
        printedDocumentLine = true
        printCheck(preparedDocumentsMessage(documentCount))
        terminal.log('')
        terminal.log(sectionTitle('Building project memory...'))
    }

    function completeInlineProgress(message: string): void {
        if (lastInlineLength === 0) {
            printCheck(message)
            return
        }

        const output = checkLine(message)
        const outputLength = visibleLength(output)
        const padding = Math.max(0, lastInlineLength - outputLength)
        terminal.writeError(`\r${output}${' '.repeat(padding)}\n`)
        lastInlineLength = 0
    }

    function printStat(label: string, value: number): void {
        terminal.log(
            `${color.dim(label.padEnd(18))} ${color.info(value.toString())}`,
        )
    }

    function preparedDocumentsMessage(documentCount: number): string {
        const moduleCount = Math.max(0, documentCount - sectionCount)

        return `Extracted ${formatCount(documentCount)} documents from ${formatCount(fileCount)} files (${formatCount(sectionCount)} sections, ${formatCount(moduleCount)} modules)`
    }

    function progressLine(message: string): string {
        return `${color.accent(spinnerFrame(spinnerIndex))} ${message}`
    }

    function checkLine(message: string): string {
        return `${color.success('✓')} ${message}`
    }

    function sectionTitle(message: string): string {
        return color.accent(message)
    }

    function formatCount(value: number): string {
        return color.info(value.toString())
    }
}

function isModelReadyEvent(event: ExtractionProgressEvent): boolean {
    return (
        event.stage === 'prepare' &&
        /Embedding model ready/u.test(event.message ?? '')
    )
}

function visibleLength(value: string): number {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '').length
}

function spinnerFrame(index: number): string {
    return ['◐', '◓', '◑', '◒'][index % 4] ?? '◐'
}
