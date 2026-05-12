import type {
    MemoryRepositoryContract,
    MemorySearchInput,
} from '@/contracts/repositories/memory-repository'
import type { MemorySearchResult } from '@/models/memory'

export class SearchMemoryAction {
    constructor(private readonly memoryRepository: MemoryRepositoryContract) {}

    async execute(input: MemorySearchInput): Promise<MemorySearchResult[]> {
        return await this.memoryRepository.search(input)
    }
}
