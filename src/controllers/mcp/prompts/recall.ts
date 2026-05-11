import raw from '@/interfaces/mcp/prompts/konteks-recall.md?raw'
import { readPromptMarkdown } from './template'

export const recallPrompt = readPromptMarkdown(raw, 'konteks-recall.md')
