import checkbox from '@inquirer/checkbox'
import select from '@inquirer/select'
import type { ScannedFile } from '@/modules/extraction/engine/file-scan'
import {
    getGrammarForPath,
    isBundledGrammar,
    listGrammarDefinitions,
} from '@/modules/extraction/engine/grammar-loader'
import consoleOutput from '@/support/console-output'
import pluralizeWord from '@/support/pluralize-word'

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

    const reviewed = {
        ...detected,
        reviewedInteractively: true,
    }

    if (detected.detectedParserIds.length === 0) {
        return reviewed
    }

    const useDetected = await select({
        choices: [
            {
                name: 'Continue',
                value: 'CONTINUE',
            },
            {
                name: 'Edit',
                value: 'EDIT',
            },
        ],
        default: 'CONTINUE',
        loop: false,
        message: getDetectedGrammarSummaryMessage(detected),
        theme: consoleOutput.withStdoutColor(color => ({
            prefix: {
                done: color.success('✓'),
            },
        })),
    })

    if (useDetected === 'CONTINUE') {
        return reviewed
    }

    const selectedRegistryParserIds = await promptForRegistryGrammars(
        detected.selectedRegistryParserIds,
    )
    const skippedFileCount = countSkippedFiles(files, selectedRegistryParserIds)

    return {
        ...reviewed,
        selectedRegistryParserIds,
        skippedFileCount,
    }
}

function canPromptForGrammars(): boolean {
    return (
        consoleOutput.stdinIsInteractive() &&
        consoleOutput.stderrIsInteractive()
    )
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
        theme: consoleOutput.withStdoutColor(color => ({
            icon: {
                checked: color.success('■'),
                unchecked: color.info('◻'),
            },
            prefix: {
                done: color.success('✓'),
            },
        })),
    })
}

function registryGrammarChoices(selected: string[]): GrammarChoice[] {
    return listGrammarDefinitions()
        .sort((left, right) =>
            left.displayName.localeCompare(right.displayName),
        )
        .map(grammar => ({
            checked: selected.includes(grammar.id),
            name: `${grammar.displayName} (${grammar.extensions.join(', ')})`,
            value: grammar.id,
        }))
}

function getDetectedGrammarSummaryMessage(
    detected: DetectedGrammarSelection,
): string {
    return consoleOutput.withStdoutColor(
        color =>
            `${color.info(detected.detectedParserIds.length.toString())} ${pluralizeWord('language', detected.detectedParserIds.length)} detected from ${color.info(detected.totalFileCount.toString())} ${pluralizeWord('file', detected.totalFileCount)}: ${color.accent(formatIds(detected.detectedParserIds))}`,
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
