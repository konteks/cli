import { printJson } from '@/app/providers/cli/json-output'
import { listKonteksTools } from '@/composition/mcp-surface'

export async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
