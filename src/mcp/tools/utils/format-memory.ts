import type { MemorySearchResult } from '@/models/memory'
import inline from './inline'

export default function formatMemory(
    item: MemorySearchResult,
    indent: number,
    includeSources = false,
): string {
    const pad = ' '.repeat(indent)
    const summary = item.excerpt.replaceAll(/\s+/gu, ' ').trim()
    const location = item.anchor
        ? `${item.path ?? item.id}#${item.anchor}`
        : (item.path ?? item.id)
    const role = item.sourceRole ?? item.kind ?? '-'
    const base = `${pad}- [${item.type}] score=${item.score} ${location} role=${role} :: ${inline(summary)}`
    if (!includeSources) {
        return base
    }
    return `${base} id=${item.id} tokens=${item.tokenCost}`
}
