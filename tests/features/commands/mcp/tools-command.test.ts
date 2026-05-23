import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    mock,
    spyOn,
} from 'bun:test'
import mcpTools from '@/entrypoints/mcp/tools'
import consoleOutput from '@/support/console-output'

const confirmCalls: unknown[] = []
const confirmResults: boolean[] = []
const inputCalls: unknown[] = []
const inputResults: string[] = []
const numberCalls: unknown[] = []
const numberResults: Array<number | undefined> = []
const selectCalls: unknown[] = []
const selectResults: unknown[] = []
const SELECT_OMIT = 'SELECT_OMIT'

mock.module('@inquirer/prompts', () => ({
    confirm: async (options: unknown) => {
        confirmCalls.push(options)

        return confirmResults.shift() ?? true
    },
    input: async (options: unknown) => {
        inputCalls.push(options)

        return inputResults.shift() ?? ''
    },
    number: async (options: unknown) => {
        numberCalls.push(options)

        return numberResults.shift()
    },
    select: async (options: unknown) => {
        selectCalls.push(options)
        const result = selectResults.shift()

        if (
            result === SELECT_OMIT &&
            isSelectOptions(options) &&
            isChoice(options.choices[0])
        ) {
            return options.choices[0].value
        }

        return result
    },
}))

beforeEach(() => {
    spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    confirmCalls.length = 0
    confirmResults.length = 0
    inputCalls.length = 0
    inputResults.length = 0
    numberCalls.length = 0
    numberResults.length = 0
    selectCalls.length = 0
    selectResults.length = 0
    mock.restore()
})

describe('commands/mcp/tools', () => {
    it('prompts required string input and passes it to the selected tool', async () => {
        selectResults.push('konteks_recall')
        confirmResults.push(true, false)
        inputResults.push('Explain the CLI command shape')
        const tool = getTool('konteks_recall')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )

        await createCommand().then(command => command.handle())

        expect(inputCalls).toEqual([
            expect.objectContaining({
                message: 'task (string):',
            }),
        ])
        expect(handleSpy).toHaveBeenCalledWith({
            task: 'Explain the CLI command shape',
        })
    })

    it('omits blank optional string fields', async () => {
        selectResults.push('konteks_warm_up')
        confirmResults.push(true, false)
        inputResults.push('')
        const tool = getTool('konteks_warm_up')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )

        await createCommand().then(command => command.handle())

        expect(handleSpy).toHaveBeenCalledWith({})
    })

    it('can omit optional boolean fields', async () => {
        selectResults.push('konteks_recall', SELECT_OMIT)
        confirmResults.push(true, false)
        inputResults.push('Find relevant context')
        const tool = getTool('konteks_recall')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )

        await createCommand().then(command => command.handle())

        expect(selectCalls[1]).toEqual(
            expect.objectContaining({
                message: 'includeSources (boolean):',
            }),
        )
        expect(handleSpy).toHaveBeenCalledWith({
            task: 'Find relevant context',
        })
    })

    it('passes optional enum selections', async () => {
        selectResults.push('konteks_forget', 'soft_delete')
        confirmResults.push(true, false)
        inputResults.push('memory#1', '', 'No longer true')
        const tool = getTool('konteks_forget')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )

        await createCommand().then(command => command.handle())

        expect(handleSpy).toHaveBeenCalledWith({
            id: 'memory#1',
            mode: 'soft_delete',
            reason: 'No longer true',
        })
    })

    it('parses complex optional fields from JSON', async () => {
        selectResults.push('konteks_save_diary')
        confirmResults.push(true, false)
        inputResults.push(
            '',
            'Session summary with enough words',
            '["cli","mcp"]',
        )
        const tool = getTool('konteks_save_diary')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )

        await createCommand().then(command => command.handle())

        expect(inputCalls[2]).toEqual(
            expect.objectContaining({
                message: 'tags (JSON):',
            }),
        )
        expect(handleSpy).toHaveBeenCalledWith({
            summary: 'Session summary with enough words',
            tags: ['cli', 'mcp'],
        })
    })

    it('retries prompts when the final schema validation fails', async () => {
        selectResults.push('konteks_recall', SELECT_OMIT, SELECT_OMIT)
        confirmResults.push(true, false)
        inputResults.push('', 'Valid task')
        const tool = getTool('konteks_recall')
        const handleSpy = spyOn(tool, 'handle').mockImplementation(
            async () => ({
                ok: true,
            }),
        )
        const errorSpy = spyOn(consoleOutput, 'writeError').mockImplementation(
            () => consoleOutput,
        )

        await createCommand().then(command => command.handle())

        expect(errorSpy).toHaveBeenCalled()
        expect(inputCalls).toHaveLength(2)
        expect(handleSpy).toHaveBeenCalledTimes(1)
        expect(handleSpy).toHaveBeenCalledWith({
            task: 'Valid task',
        })
    })
})

async function createCommand() {
    const { default: ToolsCommand } = await import(
        '@/entrypoints/cli/commands/mcp/tools-command'
    )

    return new ToolsCommand()
}

function getTool(name: string) {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return tool
}

function isSelectOptions(value: unknown): value is {
    choices: unknown[]
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'choices' in value &&
        Array.isArray(value.choices)
    )
}

function isChoice(value: unknown): value is { value: unknown } {
    return typeof value === 'object' && value !== null && 'value' in value
}
