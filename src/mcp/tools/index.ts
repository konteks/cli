import ForgetMcpTool from './forget-mcp-tool'
import RecallMcpTool from './recall-mcp-tool'
import SaveMcpTool from './save-mcp-tool'
import SearchMcpTool from './search-mcp-tool'
import WarmUpMcpTool from './warm-up-mcp-tool'

const mcpTools = [
    new WarmUpMcpTool(),
    new RecallMcpTool(),
    new SaveMcpTool(),
    new SearchMcpTool(),
    new ForgetMcpTool(),
] as const

export default mcpTools
