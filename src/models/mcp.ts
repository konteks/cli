import type { LoadedProjectContext } from '@/models/project'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

export type McpProjectContext = LoadedProjectContext
