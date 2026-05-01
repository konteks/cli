import { Language, type Node, Parser, Query } from 'web-tree-sitter'

export type TreeSitterLanguage =
    | 'html'
    | 'javascript'
    | 'jsdoc'
    | 'json'
    | 'php'
    | 'tsx'
    | 'typescript'

export type CodeSymbol = {
    name: string
    kind: string
    startLine: number
    endLine: number
    isExported: boolean
    content: string
}

export type CodeMetadata = {
    symbols: CodeSymbol[]
    imports: string[]
    exports: string[]
    language: string
}

export class TreeSitterEngine {
    private parser: Parser | undefined
    private languages: Map<string, Language> = new Map()

    async init() {
        if (this.parser) {
            return
        }

        await Parser.init()
        this.parser = new Parser()
    }

    async loadLanguage(lang: TreeSitterLanguage, wasmPath: string) {
        if (this.languages.has(lang)) {
            return
        }

        const language = await Language.load(wasmPath)
        this.languages.set(lang, language)
    }

    async parse(
        path: string,
        content: string,
    ): Promise<CodeMetadata | undefined> {
        if (!this.parser) {
            await this.init()
        }

        const lang = this.detectLanguage(path)
        if (!lang) {
            return undefined
        }

        const language = this.languages.get(lang)
        if (!language) {
            return undefined
        }

        this.parser?.setLanguage(language)
        const tree = this.parser?.parse(content)

        const metadata: CodeMetadata = {
            exports: [],
            imports: [],
            language: lang,
            symbols: [],
        }

        if (tree?.rootNode) {
            this.extractMetadata(tree.rootNode, content, metadata, lang)
        }

        return metadata
    }

    private detectLanguage(path: string): TreeSitterLanguage | undefined {
        if (path.endsWith('.jsdoc')) return 'jsdoc'
        if (/\.(json|jsonc)$/u.test(path)) return 'json'
        if (/\.(html|htm)$/u.test(path)) return 'html'
        if (/\.(php|phtml)$/u.test(path)) return 'php'
        if (path.endsWith('.tsx')) return 'tsx'
        if (path.endsWith('.ts')) return 'typescript'
        if (
            path.endsWith('.js') ||
            path.endsWith('.mjs') ||
            path.endsWith('.cjs')
        )
            return 'javascript'
        return undefined
    }

    private extractMetadata(
        root: Node,
        _: string,
        metadata: CodeMetadata,
        lang: TreeSitterLanguage,
    ) {
        // Structural symbol extraction is currently implemented only for JS/TS.
        if (lang !== 'javascript' && lang !== 'typescript' && lang !== 'tsx') {
            return
        }

        const query = this.buildQuery(root.tree.language, lang)
        const captures = query.captures(root)

        for (const capture of captures) {
            const { node, name } = capture

            if (name === 'import') {
                metadata.imports.push(node.text)
            } else if (name === 'export') {
                metadata.exports.push(node.text)
            } else if (name.startsWith('symbol_')) {
                const kind = name.split('_')[1]
                const nameNode = node.childForFieldName('name') || node.child(1)

                if (nameNode) {
                    metadata.symbols.push({
                        content: node.text,
                        endLine: node.endPosition.row,
                        isExported: this.isExported(node),
                        kind,
                        name: nameNode.text,
                        startLine: node.startPosition.row,
                    })
                }
            }
        }
    }

    private buildQuery(
        language: Language,
        lang: 'javascript' | 'typescript' | 'tsx',
    ): Query {
        const baseQueries = `
            (import_statement) @import
            (export_statement) @export
            (function_declaration) @symbol_function
            (method_definition) @symbol_method
            (class_declaration) @symbol_class
        `
        const tsQueries = `
            ${baseQueries}
            (interface_declaration) @symbol_interface
            (type_alias_declaration) @symbol_type
            (enum_declaration) @symbol_enum
        `
        const queryStr =
            lang === 'typescript' || lang === 'tsx' ? tsQueries : baseQueries

        return new Query(language, queryStr)
    }

    private isExported(node: Node): boolean {
        let current: Node | null = node
        while (current) {
            if (
                current.type === 'export_statement' ||
                current.type === 'export_declaration'
            ) {
                return true
            }
            // Check for TS-style exports or modifiers if needed
            current = current.parent
        }
        return false
    }
}
