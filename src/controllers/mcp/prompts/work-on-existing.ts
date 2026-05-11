import raw from '@/interfaces/mcp/prompts/konteks-work-on-existing.md?raw'
import { readPromptMarkdown } from '@/services/mcp-prompts'

export const workOnExistingPrompt = readPromptMarkdown(
    raw,
    'konteks-work-on-existing.md',
)
