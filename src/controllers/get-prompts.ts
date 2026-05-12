import { listKonteksPrompts } from '@/composition/mcp-surface'
import { printJson } from '@/support/cli/json-output'

export async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
