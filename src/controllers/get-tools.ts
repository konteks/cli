import { listKonteksTools } from '@/composition/mcp-surface'
import { printJson } from '@/support/cli/json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
