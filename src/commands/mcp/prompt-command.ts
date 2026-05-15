import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { getKonteksPrompt } from '@/mcp/prompts'
import parsePromptArguments from '@/support/cli/parse-prompt-arguments'
import printJson from '@/support/cli/print-json'

export default class PromptCommand extends BaseCommand<
    [string, string[] | undefined]
> {
    constructor() {
        super({
            description: 'Render one MCP prompt for debugging.',
            name: 'prompt',
        })
    }

    protected override configure(command: Command): void {
        command
            .argument('<name>', 'MCP prompt name, such as konteks-warm-up')
            .argument(
                '[input...]',
                'Optional JSON prompt arguments or free-form warm-up topic',
            )
    }

    override async handle({
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
