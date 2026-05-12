import type { Tool } from '@/app/services/mcp'
import type { z } from '@/app/services/validation'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from './inputs'

export const MCP_INSTRUCTIONS =
    'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, and call konteks_save with structured durable memories plus one diary entry during Save.'

type KonteksToolName =
    | 'konteks_warm_up'
    | 'konteks_recall'
    | 'konteks_save'
    | 'konteks_search'
    | 'konteks_forget'

type ToolCapability = 'Forget' | 'Recall' | 'Save' | 'Search' | 'Warm Up'

type ToolSurface = {
    annotations: Tool['annotations']
    capability: ToolCapability
    description: string
    inputSchema: z.ZodTypeAny
    name: KonteksToolName
}

export const KONTEKS_TOOL_SURFACE: ToolSurface[] = [
    {
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
            readOnlyHint: false,
        },
        capability: 'Warm Up',
        description:
            'Load the stable project-wide briefing for the current repo.',
        inputSchema: warmUpInputSchema,
        name: 'konteks_warm_up',
    },
    {
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
            readOnlyHint: true,
        },
        capability: 'Recall',
        description:
            'Recall compact, task-relevant project context before answering or working.',
        inputSchema: recallInputSchema,
        name: 'konteks_recall',
    },
    {
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
            readOnlyHint: false,
        },
        capability: 'Save',
        description:
            'Persist structured durable memories or one session diary entry.',
        inputSchema: saveInputSchema,
        name: 'konteks_save',
    },
    {
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
            readOnlyHint: true,
        },
        capability: 'Search',
        description:
            'Search stored memory directly and return matching records with IDs, sources, scores, and excerpts.',
        inputSchema: searchInputSchema,
        name: 'konteks_search',
    },
    {
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: false,
            readOnlyHint: false,
        },
        capability: 'Forget',
        description:
            'Delete, invalidate, or suppress stored memory that is wrong, stale, sensitive, or no longer useful.',
        inputSchema: forgetInputSchema,
        name: 'konteks_forget',
    },
]
