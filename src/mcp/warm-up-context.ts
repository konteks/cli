import { readMineManifest } from '../mining/manifest.js'
import { openProjectDatabase } from '../storage/database.js'
import type { ProjectContext } from '../types/mcp.js'
import { estimateCharacterTokens } from '../utils/format.js'

export type WarmUpContext = {
    architecture: string[]
    constraints: string[]
    conventions: string[]
    description?: string
    durableDecisions: string[]
    entryPoints: string[]
    keyFiles: string[]
    summary: string
    taxonomy: string[]
    technologies: string[]
}

type ObservationRow = {
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
        constraints: take(context.constraints, 10),
        conventions: take(context.conventions, 10),
        durableDecisions: take(context.durableDecisions, 10),
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
            constraints: ['Run `konteks init` to initialize project memory.'],
            conventions: [],
            description: 'Konteks memory is not initialized yet.',
            durableDecisions: [],
            entryPoints: [],
            keyFiles: [],
            summary: 'Konteks memory is not initialized yet.',
            taxonomy: [],
            technologies: [],
        }
    }

    const adapter = await openProjectDatabase(context)
    try {
        const modules = await adapter.query<{
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
        const observations = await adapter.query<ObservationRow>(
            `
select kind, text_inline
from observations
where deleted_at is null
  and suppressed_at is null
order by created_at desc
limit 40
`,
        )

        return {
            architecture: modules.map(
                module =>
                    `${module.path}${module.source_role ? ` (${module.source_role})` : ''} :: ${module.summary}`,
            ),
            constraints: observationsByKind(observations, 'constraint'),
            conventions: observationsByKind(observations, 'preference'),
            description: manifest.metadata.description,
            durableDecisions: observationsByKind(observations, 'decision'),
            entryPoints: manifest.metadata.entryPoints,
            keyFiles: manifest.files.slice(0, 12).map(file => file.path),
            summary: stableProjectSummary(manifest),
            taxonomy: [],
            technologies: manifest.metadata.technologies,
        }
    } finally {
        await adapter.close()
    }
}

function observationsByKind(
    observations: ObservationRow[],
    kind: string,
): string[] {
    return observations
        .filter(item => item.kind === kind)
        .map(item => item.text_inline ?? '')
        .filter(Boolean)
        .slice(0, 10)
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
