import { listKonteksTools } from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default async function getToolsCommand(): Promise<void> {
    printJson(listKonteksTools())
}
