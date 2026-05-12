import type { MemoryRepositoryContract } from '@/app/contracts/repositories/memory-repository'
import type { WarmUpContext } from '@/app/mcp/warm-up-context'
import {
    assembleWarmUpContext,
    limitWarmUpContext,
} from '@/app/mcp/warm-up-context'
import type { RecallPackage } from '@/app/models/memory'
import type { Project } from '@/app/models/project'
import { RecallMemoryAction } from './recall-memory-action'

export type WarmUpInput = {
    maxTokens?: number
    topic?: string
}

export type WarmUpResult = {
    warmUp: WarmUpContext
    recall?: RecallPackage
}

export class WarmUpAction {
    constructor(
        private readonly project: Project,
        private readonly memoryRepository: MemoryRepositoryContract,
    ) {}

    async execute(input: WarmUpInput): Promise<WarmUpResult> {
        const rawWarmUp = await assembleWarmUpContext(this.project)
        const warmUp = limitWarmUpContext(rawWarmUp, input.maxTokens ?? 2000)

        let recall: RecallPackage | undefined
        if (input.topic) {
            const recallAction = new RecallMemoryAction(this.memoryRepository)
            recall = await recallAction.execute({
                maxTokens: input.maxTokens ?? 2000,
                task: input.topic,
            })
        }

        return { recall, warmUp }
    }
}
