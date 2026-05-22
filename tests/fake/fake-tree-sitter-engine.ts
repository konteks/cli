import type { CodeMetadata } from '@/modules/extraction/engine/tree-sitter-engine'

export default class FakeTreeSitterEngine {
    public async init() {}

    public async loadLanguage(_: string, __: string) {}

    public hasLanguage() {
        return true
    }

    public async parse(path: string, content: string): Promise<CodeMetadata> {
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
