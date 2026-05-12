import { listMcpTools } from '@/app/controllers/mcp/serve'
import { printJson } from '@/app/providers/cli/json-output'

export async function getToolDetailCommand(name: string): Promise<void> {
    const tool = listMcpTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    printJson(tool)
}
