import { listKonteksPrompts } from '@/mcp/prompts'
import printJson from '@/support/cli/print-json'

export default async function getPromptsCommand(): Promise<void> {
    printJson(listKonteksPrompts())
}
