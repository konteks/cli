import type { ForgetResult } from '@/domain/entities/memory.js'
import type {
    ForgetInput,
    IMemoryRepository,
} from '@/domain/repositories/memory-repository.js'

export class ForgetMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(input: ForgetInput): Promise<ForgetResult> {
        return await this.memoryRepository.forget(input)
    }
}
