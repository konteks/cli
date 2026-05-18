import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import { terminal } from '@/support/terminal/service'

const checkboxCalls: unknown[] = []
let checkboxResult: string[] = []
const selectCalls: unknown[] = []
let selectResult = 'CONTINUE'

mock.module('@inquirer/prompts', () => ({
    checkbox: async (options: unknown) => {
        checkboxCalls.push(options)
        return checkboxResult
    },
    confirm: async () => true,
    select: async (options: unknown) => {
        selectCalls.push(options)
        return selectResult
    },
}))

afterEach(() => {
    checkboxCalls.splice(0)
    checkboxResult = []
    selectCalls.splice(0)
    selectResult = 'CONTINUE'
    mock.restore()
})

describe('grammar selection', () => {
    it('offers the current registry grammars for selection', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(true)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(true)
        const { promptForGrammars } = await import(
            '@/providers/cli/grammar-selection'
        )

        await promptForGrammars(['javascript', 'typescript'])

        const choices = (
            checkboxCalls[0] as {
                choices: Array<{ name: string; value: string }>
            }
        ).choices
        expect(choices.map(choice => choice.value)).not.toContain('markdown')
        expect(choices.map(choice => choice.value)).not.toContain('jsx')
        expect(choices.map(choice => choice.value)).toContain('typescript')
        expect(choices.map(choice => choice.value)).toContain('javascript')
        expect(choices.map(choice => choice.name)).toContain(
            'JavaScript and JSX (.js, .mjs, .cjs, .jsx)',
        )
    })

    it('auto-confirms detected registry grammars when non-interactive', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(false)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(false)
        const { reviewDetectedGrammars } = await import(
            '@/providers/cli/grammar-selection'
        )

        const result = await reviewDetectedGrammars([
            scannedFile('package.json'),
            scannedFile('src/index.ts'),
        ])

        expect(result).toEqual({
            detectedBundledParserIds: ['json'],
            detectedParserIds: ['typescript'],
            reviewedInteractively: false,
            selectedRegistryParserIds: ['typescript'],
            skippedFileCount: 0,
            totalFileCount: 2,
        })
        expect(selectCalls).toHaveLength(0)
        expect(checkboxCalls).toHaveLength(0)
    })

    it('opens checkboxes when detected grammars are rejected', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(true)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(true)
        selectResult = 'EDIT'
        checkboxResult = ['javascript']
        const { reviewDetectedGrammars } = await import(
            '@/providers/cli/grammar-selection'
        )

        const result = await reviewDetectedGrammars([
            scannedFile('src/index.ts'),
        ])

        expect(result.selectedRegistryParserIds).toEqual(['javascript'])
        expect(result.reviewedInteractively).toBe(true)
        expect(selectCalls).toHaveLength(1)
        expect(checkboxCalls).toHaveLength(1)
    })

    it('colors detected grammar review when color is supported', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(true)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(true)
        spyOn(terminal, 'stdoutSupportsColor').mockReturnValue(true)
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const { reviewDetectedGrammars } = await import(
            '@/providers/cli/grammar-selection'
        )

        await reviewDetectedGrammars([scannedFile('src/index.ts')])

        expect(logSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('language detected'),
        )
    })
})

function scannedFile(path: string): ScannedFile {
    return {
        contentHash: `hash-${path}`,
        mtimeMs: 0,
        path,
        sizeBytes: 1,
    }
}
