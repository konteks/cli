import type { MemorySearchResult } from '@/domain/entities/memory.js'
import type {
    IMemoryRepository,
    MemorySearchInput,
} from '@/domain/repositories/memory-repository.js'

export class SearchMemoryUseCase {
    constructor(private readonly memoryRepository: IMemoryRepository) {}

    async execute(input: MemorySearchInput): Promise<MemorySearchResult[]> {
        return await this.memoryRepository.search(input)
    }
}
