import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { FlexibleRegisterTool } from '../types/mcp.js'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from './inputs.js'
import {
    forgetOutputSchema,
    recallOutputSchema,
    saveOutputSchema,
    searchOutputSchema,
    warmUpOutputSchema,
} from './schemas.js'

export const MCP_INSTRUCTIONS =
    'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, and call konteks_save with structured durable memories plus one diary entry during Save.'

export type KonteksToolName =
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
    inputSchema: Tool['inputSchema']
    name: KonteksToolName
    outputSchema: Tool['outputSchema']
    parameters: string[]
}

const READ_ONLY_TOOL_ANNOTATIONS = {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
} satisfies Tool['annotations']

const WRITING_TOOL_ANNOTATIONS = {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    readOnlyHint: false,
} satisfies Tool['annotations']

export const KONTEKS_TOOL_SURFACE: ToolSurface[] = [
    {
        annotations: WRITING_TOOL_ANNOTATIONS,
        capability: 'Warm Up',
        description:
            'Load the stable project-wide briefing for the current repo.',
        inputSchema: warmUpInputSchema,
        name: 'konteks_warm_up',
        outputSchema: warmUpOutputSchema,
        parameters: [],
    },
    {
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
        capability: 'Recall',
        description:
            'Recall compact, task-relevant project context before answering or working.',
        inputSchema: recallInputSchema,
        name: 'konteks_recall',
        outputSchema: recallOutputSchema,
        parameters: ['task', 'includeSources', 'maxTokens'],
    },
    {
        annotations: WRITING_TOOL_ANNOTATIONS,
        capability: 'Save',
        description:
            'Persist structured durable memories or one session diary entry.',
        inputSchema: saveInputSchema,
        name: 'konteks_save',
        outputSchema: saveOutputSchema,
        parameters: ['type', 'memories', 'summary', 'task', 'status'],
    },
    {
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
        capability: 'Search',
        description:
            'Search stored memory directly and return matching records with IDs, sources, scores, and excerpts.',
        inputSchema: searchInputSchema,
        name: 'konteks_search',
        outputSchema: searchOutputSchema,
        parameters: ['query', 'limit'],
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
        outputSchema: forgetOutputSchema,
        parameters: ['id', 'query', 'mode', 'reason'],
    },
]

export function toolRegistrationConfig(
    surface: ToolSurface,
): Parameters<FlexibleRegisterTool>[1] {
    return {
        annotations: surface.annotations,
        description: surface.description,
        inputSchema: surface.inputSchema,
        outputSchema: surface.outputSchema,
    }
}
