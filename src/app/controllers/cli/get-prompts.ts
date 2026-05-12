import { listMcpPrompts } from '@/app/controllers/mcp/serve'
import { printJson } from '@/app/providers/cli/json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}
