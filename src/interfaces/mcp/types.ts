import type { McpServerType as McpServer } from '@/services/mcp'
import type { LoadedProjectContext } from '../../types/project'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = LoadedProjectContext

export type KonteksMcpServer = McpServer
