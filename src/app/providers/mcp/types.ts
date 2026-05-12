import type { LoadedProjectContext } from '@/app/dto/cli/project'
import type { McpServerType as McpServer } from '@/app/support/mcp'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type ProjectContext = LoadedProjectContext

export type KonteksMcpServer = McpServer
