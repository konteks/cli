import raw from '@/interfaces/mcp/prompts/konteks-save.md?raw'
import { readPromptMarkdown } from './template'

export const savePrompt = readPromptMarkdown(raw, 'konteks-save.md')
