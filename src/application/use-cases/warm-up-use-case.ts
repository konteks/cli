import type { RecallPackage } from '@/domain/entities/memory'
import type { Project } from '@/domain/entities/project'
import type { IMemoryRepository } from '@/domain/repositories/memory-repository'
import type { WarmUpContext } from '@/interfaces/mcp/warm-up-context'
import {
    assembleWarmUpContext,
    limitWarmUpContext,
} from '@/interfaces/mcp/warm-up-context'
import { RecallMemoryUseCase } from './recall-memory-use-case'

export type WarmUpInput = {
    maxTokens?: number
    topic?: string
}

export type WarmUpResult = {
    warmUp: WarmUpContext
    recall?: RecallPackage
}

export class WarmUpUseCase {
    constructor(
        private readonly project: Project,
        private readonly memoryRepository: IMemoryRepository,
    ) {}

    async execute(input: WarmUpInput): Promise<WarmUpResult> {
        const rawWarmUp = await assembleWarmUpContext(this.project)
        const warmUp = limitWarmUpContext(rawWarmUp, input.maxTokens ?? 2000)

        let recall: RecallPackage | undefined
        if (input.topic) {
            const recallUseCase = new RecallMemoryUseCase(this.memoryRepository)
            recall = await recallUseCase.execute({
                maxTokens: input.maxTokens ?? 2000,
                task: input.topic,
            })
        }

        return { recall, warmUp }
    }
}
