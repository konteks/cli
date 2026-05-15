import { getKonteksPrompt } from '@/mcp/prompts'
import parsePromptArguments from '@/support/cli/parse-prompt-arguments'
import printJson from '@/support/cli/print-json'

export default async function getPromptDetailCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getKonteksPrompt(name, parsePromptArguments(name, input)))
}
