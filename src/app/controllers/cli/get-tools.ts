import { listKonteksTools } from '@/app/composition/mcp-surface'
import { printJson } from '@/app/providers/cli/json-output'

export async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
