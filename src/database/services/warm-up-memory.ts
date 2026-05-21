import readWarmUpContext from '@/database/services/read-warm-up-context'
import type { WarmUpContext } from '@/models/memory'
import type { Project } from '@/models/project'

export async function readProjectWarmUpContext(
    context: Project,
): Promise<WarmUpContext> {
    return await readWarmUpContext(context)
}
