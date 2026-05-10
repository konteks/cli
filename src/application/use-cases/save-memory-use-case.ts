import type { SaveResult } from '@/domain/entities/memory.js'
import type {
    IMemoryRepository,
    SaveInput,
    SaveOptions,
} from '@/domain/repositories/memory-repository.js'

export class SaveMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(
        input: SaveInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await this.memoryRepository.save(input, options)
    }
}
