import type { WarmUpGuidance, WarmUpHighlight } from '@/models/memory'

export type WarmUpObservationRow = {
    id: string
    kind: string
    text_inline: string | null
}

type RankedGuidance = WarmUpGuidance & {
    score: number
}

export function targetImportance(type: WarmUpHighlight['type']): number {
    if (type === 'module') {
        return 80
    }
    if (type === 'chunk') {
        return 60
    }
    return 40
}

export function roleImportance(role: string | null): number {
    if (role === 'app_code') {
        return 35
    }
    if (role === 'package_config') {
        return 30
    }
    if (role === 'test_code') {
        return 25
    }
    if (role === 'product_doc') {
        return 15
    }
    return 5
}

export function recencyBoost(updatedAt: string): number {
    const timestamp = Date.parse(updatedAt)
    if (Number.isNaN(timestamp)) {
        return 0
    }
    const ageDays = (Date.now() - timestamp) / 86_400_000
    return Math.max(0, 10 - Math.floor(ageDays))
}

export function guidanceFromObservations(
    observations: WarmUpObservationRow[],
): WarmUpGuidance[] {
    const guidance: RankedGuidance[] = []
    for (const item of observations) {
        const kind = guidanceKind(item.kind)
        if (!kind || !item.text_inline) {
            continue
        }
        const score = guidanceScore(kind, item.text_inline)
        if (score <= 0) {
            continue
        }
        guidance.push({
            id: item.id,
            kind,
            score,
            text: item.text_inline,
        })
    }
    return guidance
        .sort(
            (left, right) =>
                right.score - left.score ||
                guidanceKindRank(left.kind) - guidanceKindRank(right.kind) ||
                left.text.length - right.text.length,
        )
        .slice(0, 8)
        .map(({ score: _score, ...item }) => item)
}

function guidanceKind(kind: string): WarmUpGuidance['kind'] | undefined {
    if (kind === 'constraint') {
        return 'constraint'
    }
    if (kind === 'decision') {
        return 'decision'
    }
    if (kind === 'preference') {
        return 'convention'
    }
    return undefined
}

function guidanceScore(kind: WarmUpGuidance['kind'], text: string): number {
    const normalized = text.toLowerCase()
    let score = 0

    if (kind === 'constraint') {
        score += 90
    } else if (kind === 'convention') {
        score += 70
    } else {
        score += 60
    }

    if (
        /\b(must|never|required|default|prefer|avoid|should)\b/u.test(
            normalized,
        )
    ) {
        score += 18
    }
    if (
        /\b(user-facing|contract|schema|prompt|tool|mcp|cli|memory|save|recall|warm-up|warm up)\b/u.test(
            normalized,
        )
    ) {
        score += 8
    }
    if (text.length <= 180) {
        score += 8
    } else if (text.length > 280) {
        score -= 12
    }
    if (
        /\b(readiness|release plan|milestone|checklist|tracked in)\b/u.test(
            normalized,
        )
    ) {
        score -= 20
    }
    if (looksLikeImplementationLog(normalized)) {
        score -= 80
    }

    return score
}

function guidanceKindRank(kind: WarmUpGuidance['kind']): number {
    if (kind === 'constraint') {
        return 0
    }
    if (kind === 'convention') {
        return 1
    }
    return 2
}

function looksLikeImplementationLog(text: string): boolean {
    return (
        /^(patched|added|removed|renamed|moved|extracted|updated|implemented|fixed|reverted)\b/u.test(
            text,
        ) ||
        /\b(now exposes|now includes|now resolves|no longer exposes|was not persisted|moved sql query logic|added regression test)\b/u.test(
            text,
        )
    )
}
