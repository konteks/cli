import z from 'zod'
import { saveDiary } from '@/memory/save-memory'
import BaseMcpTool from './_base-mcp-tool'
import saveTextSchema from './schemas/save-input-schema'

const INPUT_SCHEMA = z.object({
    subject: z.string().optional(),
    summary: saveTextSchema,
    tags: z.array(z.string()).optional(),
})

type Input = z.output<typeof INPUT_SCHEMA>

export default class SaveDiaryMcpTool extends BaseMcpTool<Input> {
    public readonly annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    public readonly description = 'Persist one compact session diary entry.'

    public readonly inputSchema = INPUT_SCHEMA

    public readonly name = 'konteks_save_diary'

    protected async coreHandle(input: Input) {
        await saveDiary(input)

        return 'konteks: session diary saved.'
    }
}
