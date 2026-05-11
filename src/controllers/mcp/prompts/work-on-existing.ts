import raw from '@/interfaces/mcp/prompts/konteks-work-on-existing.md?raw'
import { readPromptMarkdown } from './template'

export const workOnExistingPrompt = readPromptMarkdown(
    raw,
    'konteks-work-on-existing.md',
)
