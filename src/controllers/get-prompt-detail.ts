import { getKonteksPrompt } from '@/composition/mcp-surface'
import { printJson } from '@/providers/cli/json-output'
import { parsePromptArguments } from '@/providers/cli/mcp-prompt-input'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getKonteksPrompt(name, parsePromptArguments(name, input)))
}
