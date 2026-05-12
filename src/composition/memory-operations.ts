import { ForgetMemoryAction } from '@/app/actions/forget-memory-action'
import { RecallMemoryAction } from '@/app/actions/recall-memory-action'
import { SaveMemoryAction } from '@/app/actions/save-memory-action'
import { SearchMemoryAction } from '@/app/actions/search-memory-action'
import { WarmUpAction } from '@/app/actions/warm-up-action'
import { readWarmUpContext } from '@/app/providers/project/warm-up-context'
import type {
    ForgetInput,
    RecallInput,
    SaveInput,
    SearchInput,
    WarmUpInput,
} from '@/app/providers/protocol/inputs'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import type { ForgetResult, RecallPackage, SaveResult } from '@/models/memory'
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
