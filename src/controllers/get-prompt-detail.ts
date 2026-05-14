import { getKonteksPrompt } from '@/mcp/prompts'
import { printJson } from '@/support/cli/json-output'
import { parsePromptArguments } from '@/support/cli/mcp-prompt-input'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getKonteksPrompt(name, parsePromptArguments(name, input)))
}
