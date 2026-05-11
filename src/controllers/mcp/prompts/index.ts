import { readPromptMarkdown } from '@/services/mcp-prompts'

const basePath = './src/controllers/mcp/prompts'

const recallPrompt = await readPromptMarkdown(`${basePath}/konteks-recall.md`)
const savePrompt = await readPromptMarkdown(`${basePath}/konteks-save.md`)
const warmUpPrompt = await readPromptMarkdown(`${basePath}/konteks-warm-up.md`)
const workOnNewPrompt = await readPromptMarkdown(
    `${basePath}/konteks-work-on-new.md`,
)
const workOnExistingPrompt = await readPromptMarkdown(
    `${basePath}/konteks-work-on-existing.md`,
)

export default [
    recallPrompt,
    savePrompt,
    warmUpPrompt,
    workOnExistingPrompt,
    workOnNewPrompt,
]
