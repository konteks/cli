import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { LoadedProjectContext } from './project.js'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = LoadedProjectContext

export type KonteksMcpServer = McpServer
