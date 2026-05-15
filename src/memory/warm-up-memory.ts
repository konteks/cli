import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import type { StartMcpServerOptions } from '@/models/mcp'
import type {
    RecallPackage,
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from '@/models/memory'
import type { Project } from '@/models/project'
import readWarmUpContext from '@/providers/project/read-warm-up-context'
import { estimateCharacterTokens } from '@/support/format/tokens'
import createMemoryRepository from './create-memory-repository'
import { recallRepositoryMemory } from './recall'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from './runtime'

export type WarmUpResult = {
    warmUp: WarmUpContext
    recall?: RecallPackage
}

export default async function warmUpMemory(
    options: StartMcpServerOptions,
    input: { maxTokens?: number; topic?: string },
): Promise<WarmUpResult> {
    const context = await loadMcpProjectContext(options)
    await updateChangedProjectMemorySilently(context, options)

    return await withProjectDatabaseContext(context, service =>
        warmUpRepositoryMemory({
            input,
            memoryRepository: createMemoryRepository(service, context),
            project: context,
            readContext: { read: readWarmUpContext },
        }),
    )
}

async function warmUpRepositoryMemory(input: {
    input: { maxTokens?: number; topic?: string }
    memoryRepository: MemoryRepositoryContract
    project: Project
    readContext: { read(project: Project): Promise<WarmUpContext> }
}): Promise<WarmUpResult> {
    const rawWarmUp = await input.readContext.read(input.project)
    const warmUp = limitWarmUpContext(rawWarmUp, input.input.maxTokens ?? 2000)

    let recall: RecallPackage | undefined
    if (input.input.topic) {
        recall = await recallRepositoryMemory(input.memoryRepository, {
            maxTokens: input.input.maxTokens ?? 2000,
            task: input.input.topic,
        })
    }

    return { recall, warmUp }
}

function limitWarmUpContext(
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
