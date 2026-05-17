import z from 'zod'
import { saveMemories } from '@/memory/save-memory'
import BaseMcpTool from './_base-mcp-tool'
import memoryKindSchema from './schemas/memory-kind-schema'
import saveTextSchema from './schemas/save-input-schema'

const saveBatchMemorySchema = z.object({
    content: saveTextSchema,
    importance: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
    ]),
    kind: memoryKindSchema,
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
})

const INPUT_SCHEMA = {
    memories: z
        .array(saveBatchMemorySchema)
        .min(1, 'memories must contain at least one item')
        .describe('Structured durable memories to persist.'),
} satisfies Record<string, z.ZodTypeAny>

type Input = z.output<z.ZodObject<typeof INPUT_SCHEMA>>

export default class SaveMemoriesMcpTool extends BaseMcpTool<Input> {
    public readonly annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    public readonly description =
        'Persist one or more structured durable memories.'

    public readonly inputSchema = INPUT_SCHEMA

    public readonly name = 'konteks_save_memories'

    protected async coreHandle(input: Input) {
        const result = await saveMemories(input)

        return formatSaveMemoriesText(result)
    }
}

function formatSaveMemoriesText(input: {
    memoryIds?: string[]
    skippedMemories?: number
}): string {
    const memoryCount = input.memoryIds?.length ?? 0
    const parts = ['konteks: durable memories saved']

    if (memoryCount > 0) {
        parts.push(`${memoryCount} durable memories`)
    }
    if (input.skippedMemories && input.skippedMemories > 0) {
        parts.push(`${input.skippedMemories} redundant items skipped`)
    }

    return `${parts.join(', ')}.`
}
