import type { SaveResult } from '@/domain/entities/memory'
import type {
    IMemoryRepository,
    SaveInput,
    SaveOptions,
} from '@/domain/repositories/memory-repository'

export class SaveMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(
        input: SaveInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await this.memoryRepository.save(input, options)
    }
}
