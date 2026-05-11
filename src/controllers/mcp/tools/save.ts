import { SaveMemoryUseCase } from '@/application/use-cases/save-memory-use-case'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository'
import type { SaveInput } from '@/interfaces/mcp/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabaseContext,
} from '@/interfaces/mcp/project-runtime'
import { formatSaveText } from '@/interfaces/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types'
import { formatToTextResult } from './result'

export async function handleSaveTool(
    options: StartMcpServerOptions,
    input: SaveInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const saved = await withProjectDatabaseContext(context, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new SaveMemoryUseCase(repo)
        return useCase.execute(input, { projectUpdate })
    })
    return formatToTextResult(formatSaveText(saved))
}
