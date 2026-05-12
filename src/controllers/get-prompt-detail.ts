import { printJson } from '@/app/providers/cli/json-output'
import { parsePromptArguments } from '@/app/providers/cli/mcp-prompt-input'
import { getKonteksPrompt } from '@/composition/mcp-surface'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getKonteksPrompt(name, parsePromptArguments(name, input)))
}
