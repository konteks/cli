import { printJson } from '@/app/providers/cli/json-output'
import { listKonteksTools } from '@/composition/mcp-surface'

export async function getToolDetailCommand(name: string): Promise<void> {
    const tool = listKonteksTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    printJson(tool)
}
