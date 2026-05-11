import type { ForgetResult } from '@/domain/entities/memory'
import type {
    ForgetInput,
    IMemoryRepository,
} from '@/domain/repositories/memory-repository'

export class ForgetMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(input: ForgetInput): Promise<ForgetResult> {
        return await this.memoryRepository.forget(input)
    }
}
