import queryWarmUpHighlightRows from '@/database/actions/query-warm-up-highlight-rows'
import queryWarmUpModules from '@/database/actions/query-warm-up-modules'
import queryWarmUpObservations from '@/database/actions/query-warm-up-observations'
import type { WarmUpContext, WarmUpHighlight } from '@/models/memory'
import type { Project } from '@/models/project'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'
import {
    guidanceFromObservations,
    recencyBoost,
    roleImportance,
    targetImportance,
} from '@/providers/project/warm-up-ranking'
import { estimateTextTokens } from '@/support/format/tokens'

export default async function readWarmUpContext(
    context: Project,
    service: DatabaseService,
): Promise<WarmUpContext> {
    const manifest = await readExtractionManifest(context.memoryDir)
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

    const modules = await queryWarmUpModules(service.adapter)
    const highlights = await warmUpHighlights(service.adapter)
    const observations = await queryWarmUpObservations(service.adapter)

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
    const rows = await queryWarmUpHighlightRows(adapter)

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
    manifest: NonNullable<Awaited<ReturnType<typeof readExtractionManifest>>>,
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
