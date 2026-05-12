import { listKonteksTools } from '@/composition/mcp-surface'
import { printJson } from '@/support/cli/json-output'

export async function getToolDetailCommand(name: string): Promise<void> {
    const tool = listKonteksTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    printJson(tool)
}
