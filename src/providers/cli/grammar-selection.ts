import { checkbox, confirm } from '@inquirer/prompts'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import {
    getGrammarForPath,
    isBundledGrammar,
    listGrammarDefinitions,
} from '@/providers/extraction/engine/grammar-loader'
import createColorPalette from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'

export type DetectedGrammarSelection = {
    detectedBundledParserIds: string[]
    detectedParserIds: string[]
    reviewedInteractively: boolean
    selectedRegistryParserIds: string[]
    skippedFileCount: number
    totalFileCount: number
}

type GrammarChoice = {
    checked: boolean
    name: string
    value: string
}

export async function promptForGrammars(selected: string[]): Promise<string[]> {
    if (!canPromptForGrammars()) {
        return selected
    }

    return promptForRegistryGrammars(selected)
}

export async function reviewDetectedGrammars(
    files: ScannedFile[],
): Promise<DetectedGrammarSelection> {
    const detected = detectParserGrammars(files)
    if (!canPromptForGrammars()) {
        return detected
    }

    printDetectedGrammarSummary(detected)
    const reviewed = {
        ...detected,
        reviewedInteractively: true,
    }
    if (detected.detectedParserIds.length === 0) {
        return reviewed
    }

    const useDetected = await confirm({
        default: true,
        message: 'Continue or edit?',
    })

    if (useDetected) {
        return reviewed
    }

    const selectedRegistryParserIds = await promptForRegistryGrammars(
        detected.selectedRegistryParserIds,
    )
    const skippedFileCount = countSkippedFiles(files, selectedRegistryParserIds)
    if (skippedFileCount > 0) {
        terminal.log(
            `Scanned ${files.length} ${pluralize('file', files.length)}, ${skippedFileCount} ${pluralize('file', skippedFileCount)} skipped.`,
        )
    }

    return {
        ...reviewed,
        selectedRegistryParserIds,
        skippedFileCount,
    }
}

function canPromptForGrammars(): boolean {
    return terminal.stdinIsInteractive() && terminal.stderrIsInteractive()
}

function detectParserGrammars(files: ScannedFile[]): DetectedGrammarSelection {
    const detectedParserIds = new Set<string>()
    const detectedBundledParserIds = new Set<string>()
    const selectedRegistryParserIds = new Set<string>()

    for (const file of files) {
        const grammar = getGrammarForPath(file.path)
        if (!grammar) {
            continue
        }

        if (isBundledGrammar(grammar.id)) {
            detectedBundledParserIds.add(grammar.id)
        } else {
            detectedParserIds.add(grammar.id)
            selectedRegistryParserIds.add(grammar.id)
        }
    }

    return {
        detectedBundledParserIds: sortIds([...detectedBundledParserIds]),
        detectedParserIds: sortIds([...detectedParserIds]),
        reviewedInteractively: false,
        selectedRegistryParserIds: sortIds([...selectedRegistryParserIds]),
        skippedFileCount: 0,
        totalFileCount: files.length,
    }
}

async function promptForRegistryGrammars(
    selected: string[],
): Promise<string[]> {
    return checkbox({
        choices: registryGrammarChoices(selected),
        loop: true,
        message:
            'Select the programming languages or file types used in this project',
    })
}

function registryGrammarChoices(selected: string[]): GrammarChoice[] {
    return listGrammarDefinitions()
        .sort((left, right) =>
            left.displayName.localeCompare(right.displayName),
        )
        .map(grammar => ({
            checked: selected.includes(grammar.id),
            name: ` ${grammar.displayName} (${grammar.extensions.join(', ')})`,
            value: grammar.id,
        }))
}

function printDetectedGrammarSummary(detected: DetectedGrammarSelection): void {
    const color = createColorPalette(terminal.stdoutSupportsColor())
    terminal.log(
        `  ${color.info(detected.totalFileCount.toString())} ${pluralize('file', detected.totalFileCount)} will be scanned, including bundled ${pluralize('language', detected.detectedBundledParserIds.length)}: ${color.dim(formatIds(detected.detectedBundledParserIds))}`,
    )
    terminal.log(
        `  ${color.info(detected.detectedParserIds.length.toString())} ${pluralize('language', detected.detectedParserIds.length)} detected: ${color.accent(formatIds(detected.detectedParserIds))}`,
    )
}

function formatIds(ids: string[]): string {
    return ids.length > 0 ? ids.join(', ') : 'none'
}

function sortIds(ids: string[]): string[] {
    return ids.sort((left, right) => left.localeCompare(right))
}

function countSkippedFiles(files: ScannedFile[], selected: string[]): number {
    const selectedIds = new Set(selected)
    return files.filter(file => {
        const grammar = getGrammarForPath(file.path)
        return (
            grammar &&
            !isBundledGrammar(grammar.id) &&
            !selectedIds.has(grammar.id)
        )
    }).length
}

function pluralize(value: string, count: number): string {
    return count === 1 ? value : `${value}s`
}
