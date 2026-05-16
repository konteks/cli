import type z from 'zod'
import saveMemory from '@/memory/save-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import BaseMcpTool from './_base-mcp-tool'
import SAVE_INPUT_SCHEMA, {
    SAVE_PROTOCOL_INPUT_SCHEMA,
} from './utils/save-input-schema'

const INPUT_SCHEMA = SAVE_INPUT_SCHEMA

export default class SaveMcpTool extends BaseMcpTool {
    annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    description =
        'Persist structured durable memories or one session diary entry.'

    inputSchema = INPUT_SCHEMA

    name = 'konteks_save'

    override get registrationInputSchema() {
        return SAVE_PROTOCOL_INPUT_SCHEMA
    }

    protected async coreHandle(
        options: StartMcpServerOptions,
        input: z.output<typeof INPUT_SCHEMA>,
    ) {
        const result = await saveMemory(options, input)
        return formatSaveText(result)
    }
}

function formatSaveText(input: {
    diaryId?: string
    memoryIds?: string[]
    skippedMemories?: number
}): string {
    const memoryCount = input.memoryIds?.length ?? 0
    const parts = ['konteks: session saved']

    if (input.diaryId) {
        parts.push('1 diary entry')
    }
    if (memoryCount > 0) {
        parts.push(`${memoryCount} durable memories`)
    }
    if (input.skippedMemories && input.skippedMemories > 0) {
        parts.push(`${input.skippedMemories} redundant items skipped`)
    }

    return `${parts.join(', ')}.`
}
