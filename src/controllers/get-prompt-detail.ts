import { getKonteksPrompt } from '@/app/composition/mcp-surface'
import { printJson } from '@/app/providers/cli/json-output'
import { parsePromptArguments } from '@/app/providers/cli/mcp-prompt-input'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getKonteksPrompt(name, parsePromptArguments(name, input)))
}
