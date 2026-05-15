import dryRunKonteksTool from '@/mcp/dry-run-konteks-tool'
import { callKonteksTool } from '@/mcp/handlers'
import { listKonteksTools } from '@/mcp/tools'
import type { GlobalCliOptions } from '@/models/cli'
import { parseJsonInput } from '@/support/cli/print-json'
import printMcpCallResult from '@/support/cli/print-mcp-call-result'

export default async function callMcpToolCommand(
    options: GlobalCliOptions,
    name: string,
    jsonInput?: string,
    callOptions: { apply?: boolean; json?: boolean } = {},
): Promise<void> {
    const input = parseJsonInput(jsonInput)
    const tool = listKonteksTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    const isReadOnly = tool.annotations?.readOnlyHint === true
    const result =
        isReadOnly || callOptions.apply
            ? await callKonteksTool({ project: options.project }, name, input)
            : await dryRunKonteksTool(options, name, input)

    printMcpCallResult(result, {
        json: callOptions.json,
    })
}
