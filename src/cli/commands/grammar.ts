import {
    addGrammar,
    listGrammars,
    removeGrammar,
} from '../../mining/grammar-manager.js'

type GrammarAction = 'add' | 'list' | 'remove'
type GrammarLanguage = 'javascript' | 'typescript' | 'tsx'

export async function grammarCommand(
    action: GrammarAction,
    language?: string,
): Promise<void> {
    if (action === 'list') {
        const rows = await listGrammars()
        console.log(JSON.stringify(rows, null, 2))
        return
    }

    if (!language) {
        throw new Error(`Language is required for 'grammar ${action}'.`)
    }

    if (!isSupportedLanguage(language)) {
        throw new Error(`Unsupported grammar language: ${language}`)
    }

    if (action === 'add') {
        await addGrammar(language)
        console.log(`Installed grammar: ${language}`)
        return
    }

    await removeGrammar(language)
    console.log(`Removed grammar: ${language}`)
}

function isSupportedLanguage(language: string): language is GrammarLanguage {
    return (
        language === 'javascript' ||
        language === 'typescript' ||
        language === 'tsx'
    )
}
