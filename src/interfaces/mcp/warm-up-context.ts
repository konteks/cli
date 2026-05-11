import { readMineManifest } from '@/infrastructure/mining/manifest'
import { openProjectDatabase } from '@/infrastructure/persistence/sqlite/database'
import type { SqliteAdapter } from '@/infrastructure/persistence/sqlite/sqlite-adapter'
import type { ProjectContext } from '@/interfaces/mcp/types'
import { estimateCharacterTokens, estimateTextTokens } from '@/services'

export type WarmUpHighlight = {
    anchor?: string
    excerpt: string
    id: string
    path?: string
    score: number
    scoreDetails: {
        importance: number
        recency: number
        role: number
        tokenCostPenalty: number
    }
    sourceRole?: string
    tokenCost: number
    type: 'chunk' | 'diary' | 'memory' | 'module'
}

export type WarmUpGuidance = {
    id?: string
    kind: 'constraint' | 'convention' | 'decision'
    text: string
}

type RankedGuidance = WarmUpGuidance & {
    score: number
}

export type WarmUpContext = {
    architecture: string[]
    description?: string
    entryPoints: string[]
    guidance: WarmUpGuidance[]
    highlights: WarmUpHighlight[]
    keyFiles: string[]
    summary: string
    taxonomy: string[]
    technologies: string[]
}

type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
}

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

export async function assembleWarmUpContext(
    context: ProjectContext,
): Promise<WarmUpContext> {
    const manifest = await readMineManifest(context.memoryDir)
    if (!manifest) {
        return {
            architecture: [],
            description: 'Konteks memory is not initialized yet.',
            entryPoints: [],
            guidance: [
                {
                    kind: 'constraint',
                    text: 'Run `konteks init` to initialize project memory.',
                },
            ],
            highlights: [],
            keyFiles: [],
            summary: 'Konteks memory is not initialized yet.',
            taxonomy: [],
            technologies: [],
        }
    }

    const service = await openProjectDatabase(context)
    try {
        const modules = await service.adapter.query<{
            path: string
            source_role: string | null
            summary: string
        }>(
            `
select path, source_role, summary
from modules
order by chunk_count desc, file_count desc
limit 12
`,
        )
        const highlights = await warmUpHighlights(service.adapter)
        const observations = await service.adapter.query<ObservationRow>(
            `
select id, kind, text_inline
from observations
where deleted_at is null
  and suppressed_at is null
order by created_at desc
limit 120
`,
        )

        return {
            architecture: architectureFromHighlights(highlights, modules),
            description: manifest.metadata.description,
            entryPoints: manifest.metadata.entryPoints,
            guidance: guidanceFromObservations(observations),
            highlights,
            keyFiles: keyFilesFromHighlights(highlights, manifest.files),
            summary: stableProjectSummary(manifest),
            taxonomy: [],
            technologies: manifest.metadata.technologies,
        }
    } finally {
        await service.close()
    }
}

function architectureFromHighlights(
    highlights: WarmUpHighlight[],
    modules: Array<{
        path: string
        source_role: string | null
        summary: string
    }>,
): string[] {
    const moduleHighlights = highlights
        .filter(highlight => highlight.type === 'module' && highlight.path)
        .map(
            highlight =>
                `${highlight.path}${highlight.sourceRole ? ` (${highlight.sourceRole})` : ''} :: ${highlight.excerpt}`,
        )
    if (moduleHighlights.length > 0) {
        return moduleHighlights
    }
    return modules.map(
        module =>
            `${module.path}${module.source_role ? ` (${module.source_role})` : ''} :: ${module.summary}`,
    )
}

function keyFilesFromHighlights(
    highlights: WarmUpHighlight[],
    manifestFiles: Array<{ path: string }>,
): string[] {
    const paths = new Set<string>()
    for (const highlight of highlights) {
        if (highlight.path && highlight.type !== 'module') {
            paths.add(highlight.path)
        }
    }
    for (const file of manifestFiles) {
        if (paths.size >= 12) {
            break
        }
        paths.add(file.path)
    }
    return [...paths].slice(0, 12)
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

async function warmUpHighlights(
    adapter: SqliteAdapter,
): Promise<WarmUpHighlight[]> {
    const rows = await adapter.query<{
        anchor: string | null
        path: string | null
        source_role: string | null
        summary: string | null
        target_id: string
        target_type: WarmUpHighlight['type']
        token_count: number | null
        updated_at: string
    }>(
        `
select
    rd.target_id,
    rd.target_type,
    rd.source_role,
    rd.path,
    rd.anchor,
    rd.summary,
    rd.updated_at,
    c.token_count
from retrieval_documents rd
left join chunks c
    on c.id = rd.target_id
   and rd.target_type = 'chunk'
where rd.target_type in ('chunk', 'module', 'memory', 'diary')
  and not exists (
      select 1 from chunks dc
      where dc.id = rd.target_id
        and rd.target_type = 'chunk'
        and (dc.deleted_at is not null or dc.suppressed_at is not null)
  )
  and not exists (
      select 1 from observations mo
      where mo.id = rd.target_id
        and rd.target_type = 'memory'
        and (mo.deleted_at is not null or mo.suppressed_at is not null)
  )
  and not exists (
      select 1 from diary_entries dd
      where dd.id = rd.target_id
        and rd.target_type = 'diary'
        and (dd.deleted_at is not null or dd.suppressed_at is not null)
  )
order by
    case rd.target_type when 'module' then 0 when 'chunk' then 1 else 2 end,
    case rd.source_role
        when 'app_code' then 0
        when 'package_config' then 1
        when 'test_code' then 2
        when 'product_doc' then 3
        else 4
    end,
    rd.updated_at desc
limit 40
`,
    )

    return rows
        .map(row => {
            const excerpt = row.summary ?? row.path ?? row.target_id
            const tokenCost = row.token_count ?? estimateTextTokens(excerpt)
            const importance = targetImportance(row.target_type)
            const role = roleImportance(row.source_role)
            const recency = recencyBoost(row.updated_at)
            const tokenCostPenalty = Math.ceil(tokenCost / 160)
            return {
                anchor: row.anchor ?? undefined,
                excerpt,
                id: row.target_id,
                path: row.path ?? undefined,
                score: importance + role + recency - tokenCostPenalty,
                scoreDetails: {
                    importance,
                    recency,
                    role,
                    tokenCostPenalty,
                },
                sourceRole: row.source_role ?? undefined,
                tokenCost,
                type: row.target_type,
            }
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 12)
}

function targetImportance(type: WarmUpHighlight['type']): number {
    if (type === 'module') {
        return 80
    }
    if (type === 'chunk') {
        return 60
    }
    return 40
}

function roleImportance(role: string | null): number {
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

function recencyBoost(updatedAt: string): number {
    const timestamp = Date.parse(updatedAt)
    if (Number.isNaN(timestamp)) {
        return 0
    }
    const ageDays = (Date.now() - timestamp) / 86_400_000
    return Math.max(0, 10 - Math.floor(ageDays))
}

function guidanceFromObservations(
    observations: ObservationRow[],
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

function stableProjectSummary(
    manifest: NonNullable<Awaited<ReturnType<typeof readMineManifest>>>,
): string {
    const name = manifest.metadata.name ?? 'This project'
    const description = manifest.metadata.description
    const technologies = manifest.metadata.technologies.slice(0, 6).join(', ')
    const packageManager = manifest.metadata.packageManager

    if (description) {
        return `${name}: ${description}`
    }

    const details = [
        `${name} has ${manifest.fileCount} indexed files`,
        technologies ? `uses ${technologies}` : '',
        packageManager ? `uses ${packageManager}` : '',
    ].filter(Boolean)

    return `${details.join(', ')}.`
}
