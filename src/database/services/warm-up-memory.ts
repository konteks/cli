import readWarmUpContext from '@/database/services/read-warm-up-context'
import type { WarmUpContext } from '@/types/memory'
import type { Project } from '@/types/project'

export async function readProjectWarmUpContext(
    context: Project,
): Promise<WarmUpContext> {
    return await readWarmUpContext(context)
}
