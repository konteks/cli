import { callMcpTool, listMcpTools } from '@/app/controllers/mcp/serve'
import type { GlobalCliOptions } from '@/app/dto/cli/options'
import { parseJsonInput } from '@/app/providers/cli/json-output'
import { printMcpCallResult } from '@/app/providers/cli/mcp-call-output'
import { dryRunMcpTool } from '@/app/providers/cli/mcp-dry-run'

export async function callMcpToolCommand(
    options: GlobalCliOptions,
    name: string,
    jsonInput?: string,
    callOptions: { apply?: boolean; json?: boolean } = {},
): Promise<void> {
    const input = parseJsonInput(jsonInput)
    const tool = listMcpTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    const isReadOnly = tool.annotations?.readOnlyHint === true
    const result =
        isReadOnly || callOptions.apply
            ? await callMcpTool({ project: options.project }, name, input)
            : await dryRunMcpTool(options, name, input)

    printMcpCallResult(result, {
        json: callOptions.json,
    })
}
