import saveMemory from '@/memory/save-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import BaseMcpTool from './_base-mcp-tool'
import SAVE_INPUT_SCHEMA from './utils/save-input-schema'

const INPUT_SCHEMA = SAVE_INPUT_SCHEMA

type Input = typeof INPUT_SCHEMA._output

export default class SaveMcpTool extends BaseMcpTool<Input> {
    annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    description =
        'Persist structured durable memories or one session diary entry.'

    inputSchema = INPUT_SCHEMA

    name = 'konteks_save' as const

    constructor(private readonly save: typeof saveMemory = saveMemory) {
        super()
    }

    protected override async execute(
        options: StartMcpServerOptions,
        input: Input,
    ) {
        return this.formatOutput(
            formatSaveText(await this.save(options, input)),
        )
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
