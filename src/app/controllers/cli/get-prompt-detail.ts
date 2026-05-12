import { getMcpPrompt } from '@/app/controllers/mcp/serve'
import { printJson } from '@/app/providers/cli/json-output'
import { parsePromptArguments } from '@/app/providers/cli/mcp-prompt-input'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getMcpPrompt(name, parsePromptArguments(name, input)))
}
