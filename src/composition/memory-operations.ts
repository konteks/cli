import { ForgetMemoryAction } from '@/actions/forget-memory-action'
import { RecallMemoryAction } from '@/actions/recall-memory-action'
import { SaveMemoryAction } from '@/actions/save-memory-action'
import { SearchMemoryAction } from '@/actions/search-memory-action'
import { WarmUpAction } from '@/actions/warm-up-action'
import type { ForgetResult, RecallPackage, SaveResult } from '@/models/memory'
import { readWarmUpContext } from '@/providers/project/warm-up-context'
import type {
    ForgetInput,
    RecallInput,
    SaveInput,
    SearchInput,
    WarmUpInput,
} from '@/providers/protocol/inputs'
import type { StartMcpServerOptions } from '@/providers/protocol/types'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabase,
    withProjectDatabaseContext,
} from './mcp-project-runtime'
import { createMemoryRepository } from './memory-repository'

export async function recallMemory(
    options: StartMcpServerOptions,
    input: RecallInput,
): Promise<RecallPackage> {
    const context = await loadMcpProjectContext(options)
    return await withProjectDatabase(options, async service => {
        const repo = createMemoryRepository(service, context)
        const action = new RecallMemoryAction(repo)
        return action.execute(input)
    })
}

export async function searchMemory(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
    return await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
        const action = new SearchMemoryAction(repo)
        return action.execute(input)
    })
}

export async function forgetMemory(
    options: StartMcpServerOptions,
    input: ForgetInput,
): Promise<ForgetResult> {
    const context = await loadMcpProjectContext(options)
    return await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
        const action = new ForgetMemoryAction(repo)
        return action.execute(input)
    })
}

export async function saveMemory(
    options: StartMcpServerOptions,
    input: SaveInput,
): Promise<SaveResult> {
    const context = await loadMcpProjectContext(options)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    return await withProjectDatabaseContext(context, service => {
        const repo = createMemoryRepository(service, context)
        const action = new SaveMemoryAction(repo)
        return action.execute(input, { projectUpdate })
    })
}

export async function warmUpMemory(
    options: StartMcpServerOptions,
    input: WarmUpInput,
) {
    const context = await loadMcpProjectContext(options)
    await updateChangedProjectMemorySilently(context)

    return await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
        const action = new WarmUpAction(context, repo, {
            read: readWarmUpContext,
        })
        return action.execute(input)
    })
}
