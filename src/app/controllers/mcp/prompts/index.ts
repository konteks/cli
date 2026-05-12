import { readPromptMarkdown } from '@/app/services/mcp-prompts'

const basePath = './src/app/controllers/mcp/prompts'

const recallPrompt = readPromptMarkdown(`${basePath}/konteks-recall.md`)
const savePrompt = readPromptMarkdown(`${basePath}/konteks-save.md`)
const warmUpPrompt = readPromptMarkdown(`${basePath}/konteks-warm-up.md`)
const workOnNewPrompt = readPromptMarkdown(`${basePath}/konteks-work-on-new.md`)
const workOnExistingPrompt = readPromptMarkdown(
    `${basePath}/konteks-work-on-existing.md`,
)

export default [
    recallPrompt,
    savePrompt,
    warmUpPrompt,
    workOnExistingPrompt,
    workOnNewPrompt,
]
