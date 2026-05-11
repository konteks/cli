import type { MemorySearchResult } from '@/domain/entities/memory'
import type {
    IMemoryRepository,
    MemorySearchInput,
} from '@/domain/repositories/memory-repository'

export class SearchMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(input: MemorySearchInput): Promise<MemorySearchResult[]> {
        return await this.memoryRepository.search(input)
    }
}
