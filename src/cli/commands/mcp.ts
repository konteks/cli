import { startMcpServer } from '../../mcp/server.js'
import type { GlobalCliOptions } from '../options.js'

export async function mcpCommand(options: GlobalCliOptions): Promise<void> {
    await startMcpServer({ project: options.project })
}
