import { confirm, select } from '@inquirer/prompts'
import MCP_TOOLS from '@/entrypoints/mcp/tools'
import BaseCommand from '../_base-command'

export default class ToolsCommand extends BaseCommand {
    public readonly description = 'List MCP tools exposed by Konteks.'
    public readonly name = 'tools'

    public async handle(): Promise<void> {
        let loop = true

        while (loop) {
            const selectedToolName = await selectTool()

            const selectedTool = MCP_TOOLS.find(
                tool => tool.name === selectedToolName,
            )

            if (!selectedTool) {
                throw new Error(`Unknown tool: ${selectedToolName}`)
            }

            printTool(selectedTool)
            const isConfirmed = await callToolConfirmation()

            if (isConfirmed) {
                await selectedTool.handle({})

                loop = await confirm({
                    default: true,
                    message: 'Call another tool?',
                })
            }
        }
    }
}

function selectTool() {
    return select({
        choices: MCP_TOOLS.map(tool => ({
            name: `${tool.name} - ${tool.description}`,
            value: tool.name,
        })),
        message: 'Select a tool:',
    })
}

function printTool(tool: (typeof MCP_TOOLS)[number]) {
    console.log({
        annotations: tool.annotations,
        description: tool.description,
        inputSchema: 'COMING SOON',
        name: tool.name,
    })
}

function callToolConfirmation() {
    return confirm({
        default: true,
        message: 'Call this tool?',
    })
}
