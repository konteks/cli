import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { terminal } from '@/support/terminal/service'

const checkboxCalls: unknown[] = []

mock.module('@inquirer/prompts', () => ({
    checkbox: async (options: unknown) => {
        checkboxCalls.push(options)
        return []
    },
    select: async () => 'grammars',
}))

afterEach(() => {
    checkboxCalls.splice(0)
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
            ' JavaScript and JSX (.js, .mjs, .cjs, .jsx)',
        )
    })
})
