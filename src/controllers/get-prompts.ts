import { listKonteksPrompts } from '@/mcp/prompts'
import { printJson } from '@/support/cli/json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
