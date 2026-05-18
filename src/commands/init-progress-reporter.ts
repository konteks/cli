import type { ExtractionProgressEvent } from '@/contracts/services/progress'
import type { ExtractProjectResponse } from '@/models/extraction'
import createColorPalette from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'

type InitProgressReporter = {
    done(): void
    report(event: ExtractionProgressEvent): void
    skipDetectedLanguageCheck(): void
    summary(result: ExtractProjectResponse): void
}

export default function createInitProgressReporter(
    options: { scanPrinted?: boolean } = {},
): InitProgressReporter {
    let printedScan = options.scanPrinted ?? false
    let printedSections = false
    let printedParsers = false
    let generatedSummary = false
    let skipDetectedCheck = false
    let spinnerIndex = 0
    let lastInlineLength = 0
    const color = createColorPalette(terminal.stderrSupportsColor())

    return {
        done() {
            if (lastInlineLength > 0) {
                terminal.writeError('\n')
                lastInlineLength = 0
            }
        },
        report(event) {
            if (event.phase === 'scan' && event.status === 'done') {
                if (!printedScan) {
                    printedScan = true
                    if (!skipDetectedCheck) {
                        printCheck(
                            scanSummary(
                                event.total ?? 0,
                                event.detectedParserLanguages ?? [],
                            ),
                        )
                    }
                    if (skipDetectedCheck) {
                        printCheck(`Scanned ${event.total ?? 0} files`)
                    }
                }
                return
            }

            if (event.phase === 'preparation') {
                printPreparation(event)
                return
            }

            if (event.phase === 'chunks' && event.status === 'done') {
                printedSections = true
                printCheck(
                    `Extracted ${event.chunkCount ?? 0} semantic sections`,
                )
                printParsers(event.parserCount ?? 0)
                return
            }

            if (
                event.phase === 'embeddings' &&
                event.stage === 'embed' &&
                event.status === 'start'
            ) {
                terminal.log('')
                terminal.log(sectionTitle('Building project memory...'))
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
        skipDetectedLanguageCheck() {
            skipDetectedCheck = true
        },
        summary(result) {
            endInlineProgress()
            if (!printedScan) {
                if (!skipDetectedCheck) {
                    printCheck(
                        scanSummary(
                            result.fileCount,
                            result.detectedParserLanguages,
                        ),
                    )
                } else {
                    printCheck(`Scanned ${result.fileCount} files`)
                }
            }
            if (!printedSections) {
                printCheck(`Extracted ${result.chunkCount} semantic sections`)
            }
            if (!printedParsers) {
                printCheck(
                    `Loaded ${result.loadedParserCount} language parsers`,
                )
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

    function printParsers(count: number): void {
        if (printedParsers) {
            return
        }

        printedParsers = true
        printCheck(`Loaded ${count} language parsers`)
    }

    function printVectorProgress(event: ExtractionProgressEvent): void {
        const current = event.current ?? 0
        const total = event.total ?? current
        const output = progressLine(
            `${formatCount(current)}/${formatCount(total)} vectors indexed`,
        )
        spinnerIndex += 1

        const outputLength = visibleLength(output)
        const padding = Math.max(0, lastInlineLength - outputLength)
        terminal.writeError(`\r${output}${' '.repeat(padding)}`)
        lastInlineLength = outputLength
    }

    function printPreparation(event: ExtractionProgressEvent): void {
        if (!event.message) {
            return
        }

        if (event.status === 'done') {
            endInlineProgress()
            return
        }

        if (isGrammarEvent(event)) {
            printInlineProgress(grammarProgressMessage(event))
            return
        }

        if (event.stage === 'prepare') {
            printInlineProgress(modelProgressMessage(event))
        }
    }

    function printInlineProgress(message: string): void {
        const output = progressLine(message)
        spinnerIndex += 1

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
        terminal.log(`  ${color.success('✓')} ${message}`)
    }

    function printStat(label: string, value: number): void {
        terminal.log(
            `  ${color.dim(label.padEnd(18))} ${color.info(value.toString())}`,
        )
    }

    function progressLine(message: string): string {
        return `  ${color.accent(spinnerFrame(spinnerIndex))} ${message}`
    }

    function sectionTitle(message: string): string {
        return color.accent(message)
    }

    function formatCount(value: number): string {
        return color.info(value.toString())
    }
}

function scanSummary(fileCount: number, languages: string[]): string {
    return `${fileCount} ${pluralize('file', fileCount)} scanned, ${languages.length} ${pluralize('language', languages.length)} detected: ${formatIds(languages)}`
}

function formatIds(ids: string[]): string {
    return ids.length > 0 ? ids.join(', ') : 'none'
}

function pluralize(value: string, count: number): string {
    return count === 1 ? value : `${value}s`
}

function isGrammarEvent(event: ExtractionProgressEvent): boolean {
    return event.stage !== 'prepare'
}

function grammarProgressMessage(event: ExtractionProgressEvent): string {
    if (event.status === 'start') {
        return 'Preparing language parsers'
    }

    if (/^Downloading /u.test(event.message ?? '')) {
        return event.message ?? 'Downloading language parser'
    }

    if (/^Loaded /u.test(event.message ?? '')) {
        return parserCountMessage(event.current, event.total)
    }

    if (/^Using cached /u.test(event.message ?? '')) {
        return parserCountMessage(event.current, event.total)
    }

    if (/Tree-sitter grammars ready/u.test(event.message ?? '')) {
        return parserCountMessage(event.total, event.total)
    }

    return 'Preparing language parsers'
}

function modelProgressMessage(event: ExtractionProgressEvent): string {
    if (/Embedding model ready/u.test(event.message ?? '')) {
        return 'Embedding model ready'
    }

    if (event.downloadPercent !== undefined) {
        return `Loading embedding model ${event.downloadPercent.toFixed(1)}%`
    }

    return 'Loading embedding model'
}

function parserCountMessage(
    current: number | undefined,
    total: number | undefined,
): string {
    if (current === undefined || total === undefined) {
        return 'Preparing language parsers'
    }

    return `${current}/${total} language parsers ready`
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
