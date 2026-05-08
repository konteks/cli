import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import type { MemorySearchResult } from '../memory/search-store.js'
import type { loadProjectContext } from '../project/context.js'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = Awaited<ReturnType<typeof loadProjectContext>>

export type FlexibleRegisterTool = (
    name: string,
    config: {
        annotations?: Tool['annotations']
        description: string
        inputSchema: Tool['inputSchema']
        outputSchema?: Tool['outputSchema']
    },
    callback: (input: unknown) => CallToolResult | Promise<CallToolResult>,
) => unknown

export type ToolRegistration = {
    annotations?: Tool['annotations']
    callback: (input: unknown) => CallToolResult | Promise<CallToolResult>
    description: string
    inputSchema: Tool['inputSchema']
    name: string
    outputSchema?: Tool['outputSchema']
}

export type RecallGraphItem = {
    entityId: string
    entityName: string
    entityType: string
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    depth: number
    score: number
    relatedEntityId: string
    relatedEntityName: string
    relatedEntityType: string
}

export type RecallHistoryItem = {
    relationId: string
    predicate: string
    status: 'invalidated' | 'superseded'
    subjectEntityId: string
    subjectEntityName: string
    objectEntityId: string
    objectEntityName: string
    validFrom?: string
    validTo?: string
    reason: string
}

export type RecallQuality = 'partial' | 'strong' | 'weak'

export type RecallPackage = {
    brief: string[]
    graph: RecallGraphItem[]
    history: RecallHistoryItem[]
    memories: MemorySearchResult[]
    primaryTargets: string[]
    quality: RecallQuality
    sourceCount: number
    task: string
    tokenBudget: number
}
