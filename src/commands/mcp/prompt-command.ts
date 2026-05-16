import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { getKonteksPrompt } from '@/mcp/prompts'
import parsePromptArguments from '@/support/cli/parse-prompt-arguments'
import printJson from '@/support/cli/print-json'

export default class PromptCommand extends BaseCommand<
    [string, string[] | undefined]
> {
    override readonly args = [
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
    readonly description = 'Render one MCP prompt for debugging.'
    readonly name = 'prompt'

    async handle({
        args,
    }: BaseCommandInput<[string, string[] | undefined]>): Promise<void> {
        printJson(
            getKonteksPrompt(
                args[0],
                parsePromptArguments(args[0], args[1]?.join(' ')),
            ),
        )
    }
}
