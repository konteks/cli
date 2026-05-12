import type { WarmUpContext, WarmUpHighlight } from '@/models/memory'
import type { Project } from '@/models/project'
import { readMineManifest } from '@/providers/extraction/engine/manifest'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'
import { estimateTextTokens } from '@/support/format/tokens'
import {
    guidanceFromObservations,
    recencyBoost,
    roleImportance,
    targetImportance,
    type WarmUpObservationRow,
} from './warm-up-ranking'

export async function readWarmUpContext(
    context: Project,
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
        const observations = await service.adapter.query<WarmUpObservationRow>(
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
