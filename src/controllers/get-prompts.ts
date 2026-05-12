import { listKonteksPrompts } from '@/composition/mcp-surface'
import { printJson } from '@/providers/cli/json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
