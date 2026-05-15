import type {
    CodeMetadata,
    TreeSitterLanguage,
} from '@/providers/extraction/engine/tree-sitter-engine'

export default class FakeTreeSitterEngine {
    async init() {}

    async loadLanguage(_: TreeSitterLanguage, __: string) {}

    hasLanguage() {
        return true
    }

    async parse(path: string, content: string): Promise<CodeMetadata> {
        return {
            exports: [],
            imports: [],
            language: path.split('.').at(-1) ?? 'text',
            symbols: extractFakeSymbols(content),
        }
    }
}

function extractFakeSymbols(content: string): CodeMetadata['symbols'] {
    return content
        .split('\n')
        .map((line, index) => {
            const name = line.match(
                /^\s*(?:export\s+)?(?:const|let|var|function|class|interface|type)\s+([A-Za-z0-9_$]+)/u,
            )?.[1]
            if (!name) {
                return undefined
            }
            return {
                content: line,
                endLine: index,
                isExported: line.trimStart().startsWith('export '),
                kind: 'declaration',
                name,
                startLine: index,
            }
        })
        .filter((symbol): symbol is CodeMetadata['symbols'][number] =>
            Boolean(symbol),
        )
}
