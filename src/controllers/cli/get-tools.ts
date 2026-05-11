import { listMcpTools } from '@/interfaces/mcp/server'
import { printJson } from './json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listMcpTools())
}
