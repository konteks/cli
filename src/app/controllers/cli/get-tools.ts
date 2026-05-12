import { listMcpTools } from '@/app/controllers/mcp/serve'
import { printJson } from './json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listMcpTools())
}
