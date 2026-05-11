import { listMcpPrompts } from '@/interfaces/mcp/server'
import { printJson } from './json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}
