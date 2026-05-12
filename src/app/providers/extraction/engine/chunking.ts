import { terminal } from '@/app/support/terminal/service'
import type { ScannedFile } from './file-scan'
import type { CodeMetadata, TreeSitterEngine } from './tree-sitter-engine'

type MinedChunk = {
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

export async function chunkFile(
    file: ScannedFile,
    content: string,
    engine?: TreeSitterEngine,
    parsedMetadata?: CodeMetadata,
): Promise<MinedChunk[]> {
    const trimmed = content.trim()
    if (!trimmed) {
        return []
    }

    if (isMarkdown(file.path)) {
        return chunkMarkdown(file.path, trimmed)
    }

    if (isJson(file.path)) {
        return chunkJson(file.path, trimmed)
    }

    if (isCode(file.path)) {
        if (parsedMetadata && parsedMetadata.symbols.length > 0) {
            return chunkCodeWithTreeSitter(file.path, parsedMetadata)
        }
        if (engine) {
            try {
                const metadata = await engine.parse(file.path, content)
                if (metadata && metadata.symbols.length > 0) {
                    return chunkCodeWithTreeSitter(file.path, metadata)
                }
            } catch (error) {
                // Fallback to heuristic if engine fails
                terminal.error(`Tree-sitter failed for ${file.path}:`, error)
            }
        }
        return chunkCodeHeuristic(file.path, trimmed)
    }

    return chunkByWords(file.path, trimmed, 'text')
}

function chunkCodeWithTreeSitter(
    path: string,
    metadata: CodeMetadata,
): MinedChunk[] {
    return metadata.symbols.flatMap(symbol => {
        return chunkByWords(path, symbol.content, 'code', {
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

function chunkCodeHeuristic(path: string, content: string): MinedChunk[] {
    const lines = content.split('\n')
    const chunks: MinedChunk[] = []
    let current: string[] = []
    let currentSymbol: string | undefined

    for (const line of lines) {
        const symbol = extractCodeSymbol(line)
        if (symbol && current.length > 0) {
            chunks.push(
                ...chunkByWords(path, current.join('\n'), 'code', {
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
        chunks.push(
            ...chunkByWords(path, current.join('\n'), 'code', {
                anchor: currentSymbol,
                anchorType: currentSymbol ? 'symbol' : 'file',
                symbol: currentSymbol,
            }),
        )
    }

    return chunks.length > 0 ? chunks : chunkByWords(path, content, 'code')
}

function chunkMarkdown(path: string, content: string): MinedChunk[] {
    const sections = content.split(/(?=^#{1,6}\s+)/gmu).filter(Boolean)
    const chunks = sections.length > 0 ? sections : [content]

    return chunks.flatMap(section => {
        const heading = section.match(/^#{1,6}\s+(.+)$/mu)?.[1]?.trim()
        return chunkByWords(path, section, 'markdown', {
            anchor: heading ? slugify(heading) : undefined,
            anchorType: heading ? 'heading' : 'file',
            heading,
            symbol: heading,
        })
    })
}

function chunkJson(path: string, content: string): MinedChunk[] {
    try {
        const parsed = JSON.parse(content) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return Object.entries(parsed).flatMap(([key, value]) =>
                chunkByWords(
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
        return chunkByWords(path, content, 'json')
    }

    return chunkByWords(path, content, 'json')
}

function chunkByWords(
    path: string,
    content: string,
    kind: string,
    metadata: {
        anchor?: string
        anchorType?: MinedChunk['anchorType']
        heading?: string
        jsonPath?: string
        symbol?: string
        startLine?: number
        endLine?: number
        metadata?: Record<string, unknown>
    } = {},
): MinedChunk[] {
    const words = content.split(/\s+/u).filter(Boolean)
    const maxWords = 650
    const anchor = metadata.anchor ?? 'file'
    const anchorType = metadata.anchorType ?? 'file'
    if (words.length <= maxWords) {
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

    const chunks: MinedChunk[] = []
    for (let index = 0; index < words.length; index += maxWords) {
        const body = words.slice(index, index + maxWords).join(' ')
        const chunkAnchor = `${anchor}-${Math.floor(index / maxWords) + 1}`
        chunks.push({
            anchor: chunkAnchor,
            anchorType,
            content: body,
            endLine: metadata.endLine,
            heading: metadata.heading,
            jsonPath: metadata.jsonPath,
            kind,
            metadata: metadata.metadata,
            path,
            startLine: metadata.startLine,
            summary: summarize(path, kind, body, metadata.symbol),
            symbol: metadata.symbol,
        })
    }

    return chunks
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
    return `${kind} chunk from ${label}${preview}`
}

function isMarkdown(path: string): boolean {
    return /\.(md|mdx)$/iu.test(path)
}

function isJson(path: string): boolean {
    return /\.(json|jsonc)$/iu.test(path)
}

function isCode(path: string): boolean {
    return /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|rs|java|kt|rb|php)$/iu.test(
        path,
    )
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '')
}
