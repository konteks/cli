import { listMcpTools } from '@/interfaces/mcp/server'
import { printJson } from './json-output'

export async function getToolDetailCommand(name: string): Promise<void> {
    const tool = listMcpTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    printJson(tool)
}
