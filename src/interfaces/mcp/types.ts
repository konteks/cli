import type { LoadedProjectContext } from '@/dto/project'
import type { McpServerType as McpServer } from '@/services/mcp'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = LoadedProjectContext

export type KonteksMcpServer = McpServer
