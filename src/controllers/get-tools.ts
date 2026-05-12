import { listKonteksTools } from '@/composition/mcp-surface'
import { printJson } from '@/providers/cli/json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
