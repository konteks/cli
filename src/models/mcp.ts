import type { LoadedProjectContext } from '@/models/project'
import type TreeSitterEngine from '@/providers/extraction/engine/tree-sitter-engine'

export type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
    treeSitterEngine?: TreeSitterEngine
}

export type McpProjectContext = LoadedProjectContext
