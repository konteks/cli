import type {
    ForgetInput,
    MemoryRepositoryContract,
} from '@/contracts/repositories/memory-repository'
import type { ForgetResult } from '@/models/memory'

export class ForgetMemoryAction {
    constructor(private readonly memoryRepository: MemoryRepositoryContract) {}

    async execute(input: ForgetInput): Promise<ForgetResult> {
        return await this.memoryRepository.forget(input)
    }
}
