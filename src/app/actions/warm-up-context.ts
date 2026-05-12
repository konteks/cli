import type {
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from '@/app/models/memory'
import { estimateCharacterTokens } from '@/app/support/format/tokens'

export function limitWarmUpContext(
    context: WarmUpContext,
    maxTokens: number,
): WarmUpContext {
    const budget = Math.max(80, maxTokens)
    const baseCost = estimateCharacterTokens([
        context.summary,
        context.description ?? '',
        ...context.technologies,
        ...context.entryPoints,
    ])
    let remaining = Math.max(0, budget - baseCost)

    const take = (items: string[], fallbackLimit: number): string[] => {
        const kept: string[] = []
        for (const item of items.slice(0, fallbackLimit)) {
            const cost = estimateCharacterTokens([item])
            if (kept.length > 0 && cost > remaining) {
                break
            }
            kept.push(item)
            remaining -= cost
        }
        return kept
    }

    return {
        ...context,
        architecture: take(context.architecture, 12),
        guidance: takeGuidance(context.guidance, 8),
        highlights: takeHighlights(context.highlights, 12),
        keyFiles: take(context.keyFiles, 12),
    }
}

function takeHighlights(
    highlights: WarmUpHighlight[],
    fallbackLimit: number,
): WarmUpHighlight[] {
    return highlights.slice(0, fallbackLimit)
}

function takeGuidance(
    guidance: WarmUpGuidance[],
    fallbackLimit: number,
): WarmUpGuidance[] {
    return guidance.slice(0, fallbackLimit)
}
