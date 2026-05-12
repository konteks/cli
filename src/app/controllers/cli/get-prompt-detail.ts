import { getMcpPrompt } from '@/app/controllers/mcp/serve'
import { printJson } from './json-output'
import { parsePromptArguments } from './mcp-prompt-input'

export async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getMcpPrompt(name, parsePromptArguments(name, input)))
}
