import { listKonteksTools } from '@/mcp/tools'
import { printJson } from '@/support/cli/json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
