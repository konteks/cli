import queryWarmUpHighlightRows from '@/database/actions/query-warm-up-highlight-rows'
import queryWarmUpModules from '@/database/actions/query-warm-up-modules'
import queryWarmUpObservations from '@/database/actions/query-warm-up-observations'
import { readExtractionManifest } from '@/modules/extraction/engine/manifest'
import {
    guidanceFromObservations,
    recencyBoost,
    roleImportance,
    targetImportance,
} from '@/modules/project/warm-up-ranking'
import { estimateTextTokens } from '@/support/format/tokens'
import type { WarmUpContext, WarmUpHighlight } from '@/types/memory'
import type { Project } from '@/types/project'

export default async function readWarmUpContext(
    context: Project,
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
            taxonomy: [],
            technologies: [],
        }
    }

    const modules = await queryWarmUpModules()
    const highlights = await warmUpHighlights()
    const observations = await queryWarmUpObservations()

    return {
        architecture: architectureFromHighlights(highlights, modules),
        description: manifest.metadata.description,
        entryPoints: manifest.metadata.entryPoints,
        guidance: guidanceFromObservations(observations),
        highlights,
        keyFiles: keyFilesFromHighlights(highlights, manifest.files),
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

async function warmUpHighlights(): Promise<WarmUpHighlight[]> {
    const rows = await queryWarmUpHighlightRows()

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
