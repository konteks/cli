import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { getKonteksPrompt } from '@/mcp/prompts'
import printJson from '@/support/cli/print-json'
import { parseJsonInput } from '@/support/json/io'
import { isRecord } from '@/support/object/value'

export default class PromptCommand extends BaseCommand<
    [string, string[] | undefined]
> {
    public override readonly args = [
        {
            description: 'MCP prompt name, such as konteks-warm-up',
            name: '<name>',
        },
        {
            description:
                'Optional JSON prompt arguments or free-form warm-up topic',
            name: '[input...]',
        },
    ]
    public readonly description = 'Render one MCP prompt for debugging.'
    public readonly name = 'prompt'

    public async handle({
        args,
    }: Required<
        BaseCommandInput<[string, string[] | undefined]>
    >): Promise<void> {
        printJson(
            getKonteksPrompt(
                args[0],
                parsePromptArguments(args[0], args[1]?.join(' ')),
            ),
        )
    }
}

function parsePromptArguments(
    name: string,
    input?: string,
): Record<string, string> {
    const trimmed = input?.trim()
    if (!trimmed) {
        return {}
    }

    if (name === 'konteks-warm-up' && !looksLikeJson(trimmed)) {
        return { topic: trimmed }
    }

    const parsed = parseJsonInput(trimmed)
    if (!isRecord(parsed)) {
        throw new Error('Prompt arguments must be a JSON object.')
    }

    const args: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
            throw new Error(`Prompt argument "${key}" must be a string.`)
        }
        args[key] = value
    }

    return args
}

function looksLikeJson(value: string): boolean {
    return value.startsWith('{') || value.startsWith('[')
}
