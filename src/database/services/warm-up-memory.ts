import { openProjectDatabase } from '@/database/actions/_db'
import readWarmUpContext from '@/database/services/read-warm-up-context'
import type { WarmUpContext } from '@/models/memory'
import type { Project } from '@/models/project'

export async function readProjectWarmUpContext(
    context: Project,
): Promise<WarmUpContext> {
    const connection = await openProjectDatabase(context)
    try {
        return await readWarmUpContext(context, connection)
    } finally {
        await connection.close()
    }
}
