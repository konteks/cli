import raw from '@/interfaces/mcp/prompts/konteks-work-on-new.md?raw'
import { readPromptMarkdown } from './template'

export const workOnNewPrompt = readPromptMarkdown(raw, 'konteks-work-on-new.md')
