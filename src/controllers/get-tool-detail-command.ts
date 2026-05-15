import { listKonteksTools } from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default async function getToolDetailCommand(
    name: string,
): Promise<void> {
    const tool = listKonteksTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    printJson(tool)
}
