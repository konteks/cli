import { listMcpPrompts } from '@/controllers/mcp/serve'
import { printJson } from './json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}
