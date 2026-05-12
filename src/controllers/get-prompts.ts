import { printJson } from '@/app/providers/cli/json-output'
import { listKonteksPrompts } from '@/composition/mcp-surface'

export async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
