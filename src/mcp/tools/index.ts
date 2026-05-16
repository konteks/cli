import ForgetMcpTool from './forget-mcp-tool'
import RecallMcpTool from './recall-mcp-tool'
import SaveDiaryMcpTool from './save-diary-mcp-tool'
import SaveMemoriesMcpTool from './save-memories-mcp-tool'
import SearchMcpTool from './search-mcp-tool'
import WarmUpMcpTool from './warm-up-mcp-tool'

const mcpTools = [
    new WarmUpMcpTool(),
    new RecallMcpTool(),
    new SaveMemoriesMcpTool(),
    new SaveDiaryMcpTool(),
    new SearchMcpTool(),
    new ForgetMcpTool(),
] as const

export default mcpTools
