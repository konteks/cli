import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemorySearchResult } from '../infrastructure/persistence/sqlite/search-store.js'
import type { LoadedProjectContext } from './project.js'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = LoadedProjectContext

export type KonteksMcpServer = McpServer

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

export type RecallPackage = {
    brief: string[]
    graph: RecallGraphItem[]
    history: RecallHistoryItem[]
    memories: MemorySearchResult[]
    primaryTargets: string[]
    quality: 'partial' | 'strong' | 'weak'
    sourceCount: number
    task: string
    tokenBudget: number
}
