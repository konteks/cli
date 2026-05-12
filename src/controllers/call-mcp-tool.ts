import {
    callKonteksTool,
    dryRunKonteksTool,
    listKonteksTools,
} from '@/composition/mcp-tools'
import type { GlobalCliOptions } from '@/models/cli'
import { parseJsonInput } from '@/support/cli/json-output'
import { printMcpCallResult } from '@/support/cli/mcp-call-output'

export async function callMcpToolCommand(
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
