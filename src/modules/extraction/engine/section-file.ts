import type { ScannedFile } from './file-scan'
import { getGrammarForPath, isBundledGrammar } from './grammar-loader'
import type TreeSitterEngine from './tree-sitter-engine'
import type { CodeMetadata } from './tree-sitter-engine'

type ExtractedSection = {
    anchor: string
    anchorType: 'file' | 'heading' | 'json_path' | 'symbol'
    content: string
    kind: string
    path: string
    jsonPath?: string
    heading?: string
    summary: string
    symbol?: string
    startLine?: number
    endLine?: number
    metadata?: Record<string, unknown>
}

export default async function sectionFile(
    file: ScannedFile,
    content: string,
    engine?: TreeSitterEngine,
    parsedMetadata?: CodeMetadata,
): Promise<ExtractedSection[]> {
    const trimmed = content.trim()
    if (!trimmed) {
        return []
    }

    if (isMarkdown(file.path)) {
        return sectionMarkdown(file.path, trimmed)
    }

    if (isJson(file.path)) {
        return sectionJson(file.path, trimmed)
    }

    if (isCode(file.path)) {
        if (parsedMetadata) {
            return sectionCodeWithTreeSitter(file.path, trimmed, parsedMetadata)
        }
        if (engine) {
            const metadata = await engine.parse(file.path, content)
            if (metadata) {
                return sectionCodeWithTreeSitter(file.path, trimmed, metadata)
            }
        }
        return sectionCodeHeuristic(file.path, trimmed)
    }

    return sectionByWords(file.path, trimmed, 'text')
}

function sectionCodeWithTreeSitter(
    path: string,
    content: string,
    metadata: CodeMetadata,
): ExtractedSection[] {
    if (metadata.symbols.length === 0) {
        return sectionByWords(path, content, 'code', {
            metadata: {
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            },
        })
    }

    return metadata.symbols.flatMap(symbol => {
        return sectionByWords(path, symbol.content, 'code', {
            anchor: symbol.name,
            anchorType: 'symbol',
            endLine: symbol.endLine,
            metadata: {
                exported: symbol.isExported,
                nodeKind: symbol.kind,
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            },
            startLine: symbol.startLine,
            symbol: symbol.name,
        })
    })
}

function sectionCodeHeuristic(
    path: string,
    content: string,
): ExtractedSection[] {
    const lines = content.split('\n')
    const sections: ExtractedSection[] = []
    let current: string[] = []
    let currentSymbol: string | undefined

    for (const line of lines) {
        const symbol = extractCodeSymbol(line)
        if (symbol && current.length > 0) {
            sections.push(
                ...sectionByWords(path, current.join('\n'), 'code', {
                    anchor: currentSymbol,
                    anchorType: currentSymbol ? 'symbol' : 'file',
                    symbol: currentSymbol,
                }),
            )
            current = []
        }

        currentSymbol = symbol ?? currentSymbol
        current.push(line)
    }

    if (current.length > 0) {
        sections.push(
            ...sectionByWords(path, current.join('\n'), 'code', {
                anchor: currentSymbol,
                anchorType: currentSymbol ? 'symbol' : 'file',
                symbol: currentSymbol,
            }),
        )
    }

    return sections.length > 0
        ? sections
        : sectionByWords(path, content, 'code')
}

function sectionMarkdown(path: string, content: string): ExtractedSection[] {
    const sections = content.split(/(?=^#{1,6}\s+)/gmu).filter(Boolean)
    const sectionTexts = sections.length > 0 ? sections : [content]

    return sectionTexts.flatMap(section => {
        const heading = section.match(/^#{1,6}\s+(.+)$/mu)?.[1]?.trim()
        return sectionByWords(path, section, 'markdown', {
            anchor: heading ? slugify(heading) : undefined,
            anchorType: heading ? 'heading' : 'file',
            heading,
            symbol: heading,
        })
    })
}

function sectionJson(path: string, content: string): ExtractedSection[] {
    try {
        const parsed = JSON.parse(content) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return Object.entries(parsed).flatMap(([key, value]) =>
                sectionByWords(
                    path,
                    JSON.stringify({ [key]: value }, null, 2),
                    'json',
                    {
                        anchor: key,
                        anchorType: 'json_path',
                        jsonPath: key,
                        symbol: key,
                    },
                ),
            )
        }
    } catch {
        return sectionByWords(path, content, 'json')
    }

    return sectionByWords(path, content, 'json')
}

function sectionByWords(
    path: string,
    content: string,
    kind: string,
    metadata: {
        anchor?: string
        anchorType?: ExtractedSection['anchorType']
        heading?: string
        jsonPath?: string
        symbol?: string
        startLine?: number
        endLine?: number
        metadata?: Record<string, unknown>
    } = {},
): ExtractedSection[] {
    const anchor = metadata.anchor ?? 'file'
    const anchorType = metadata.anchorType ?? 'file'
    return [
        {
            anchor,
            anchorType,
            content,
            endLine: metadata.endLine,
            heading: metadata.heading,
            jsonPath: metadata.jsonPath,
            kind,
            metadata: metadata.metadata,
            path,
            startLine: metadata.startLine,
            summary: summarize(path, kind, content, metadata.symbol),
            symbol: metadata.symbol,
        },
    ]
}

function extractCodeSymbol(line: string): string | undefined {
    return line.match(
        /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+([A-Za-z0-9_$]+)/u,
    )?.[1]
}

function summarize(
    path: string,
    kind: string,
    content: string,
    symbol?: string,
): string {
    const firstLine = content
        .trim()
        .split('\n')
        .find(line => line.trim().length > 0)
        ?.trim()
    const label = symbol ? `${path}#${symbol}` : path
    const preview = firstLine ? `: ${firstLine.slice(0, 120)}` : ''
    return `${kind} section from ${label}${preview}`
}

function isMarkdown(path: string): boolean {
    return /\.(md|mdx)$/iu.test(path)
}

function isJson(path: string): boolean {
    return /\.(json|jsonc)$/iu.test(path)
}

function isCode(path: string): boolean {
    const grammar = getGrammarForPath(path)
    return Boolean(grammar && !isBundledGrammar(grammar.id))
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '')
}
