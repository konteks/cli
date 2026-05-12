import { listMcpPrompts } from '@/app/controllers/mcp'
import { printJson } from './json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}
