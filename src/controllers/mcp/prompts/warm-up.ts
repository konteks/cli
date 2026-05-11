import raw from '@/interfaces/mcp/prompts/konteks-warm-up.md?raw'
import { readPromptMarkdown } from './template'

export const warmUpPrompt = readPromptMarkdown(raw, 'konteks-warm-up.md')
