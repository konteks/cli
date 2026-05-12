import { listMcpTools } from '@/app/controllers/mcp/serve'
import { printJson } from '@/app/providers/cli/json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listMcpTools())
}
