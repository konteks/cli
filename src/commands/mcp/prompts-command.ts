import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { listKonteksPrompts } from '@/mcp/prompts'
import printJson from '@/support/cli/print-json'

export default class PromptsCommand extends BaseCommand {
    readonly description = 'List MCP prompts exposed by Konteks.'
    readonly name = 'prompts'

    async handle(_input: BaseCommandInput): Promise<void> {
        printJson(listKonteksPrompts())
    }
}
