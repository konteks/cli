import z from 'zod'
import { saveDiary } from '@/memory/save-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import BaseMcpTool from './_base-mcp-tool'
import saveTextSchema from './schemas/save-input-schema'

const INPUT_SCHEMA = z.object({
    subject: z.string().optional(),
    summary: saveTextSchema,
    tags: z.array(z.string()).optional(),
})

type Input = z.output<typeof INPUT_SCHEMA>

export default class SaveDiaryMcpTool extends BaseMcpTool<Input> {
    annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    description = 'Persist one compact session diary entry.'

    readonly inputSchema = INPUT_SCHEMA

    name = 'konteks_save_diary'

    protected async coreHandle(options: StartMcpServerOptions, input: Input) {
        await saveDiary(options, input)

        return 'konteks: session diary saved.'
    }
}
