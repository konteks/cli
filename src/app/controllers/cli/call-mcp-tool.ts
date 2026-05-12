import {
    callKonteksTool,
    dryRunKonteksTool,
    listKonteksTools,
} from '@/app/composition/mcp-tools'
import type { GlobalCliOptions } from '@/app/models/cli'
import { parseJsonInput } from '@/app/providers/cli/json-output'
import { printMcpCallResult } from '@/app/providers/cli/mcp-call-output'

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
