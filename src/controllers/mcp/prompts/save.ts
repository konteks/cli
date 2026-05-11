import raw from '@/interfaces/mcp/prompts/konteks-save.md?raw'
import { readPromptMarkdown } from '@/services/mcp-prompts'

export const savePrompt = readPromptMarkdown(raw, 'konteks-save.md')
