import type {
    MemoryRepositoryContract,
    SaveInput,
    SaveOptions,
} from '@/app/contracts/repositories/memory-repository'
import type { SaveResult } from '@/models/memory'

export class SaveMemoryAction {
    constructor(private readonly memoryRepository: MemoryRepositoryContract) {}

    async execute(
        input: SaveInput,
        options?: SaveOptions,
    ): Promise<SaveResult> {
        return await this.memoryRepository.save(input, options)
    }
}
