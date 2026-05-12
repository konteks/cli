import { listKonteksPrompts } from '@/app/composition/mcp-surface'
import { printJson } from '@/app/providers/cli/json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
