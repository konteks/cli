import { ProjectStatusAction } from '@/app/actions/project-status-action'
import type { ProjectStatus } from '@/app/contracts/services/project-status-reader'
import { loadProjectContext } from '@/app/providers/project/context'
import { ProjectStatusReader } from '@/app/providers/project/status-reader'

export async function readProjectStatus(
    projectOverride?: string,
): Promise<ProjectStatus> {
    const context = await loadProjectContext(projectOverride)
    const action = new ProjectStatusAction(new ProjectStatusReader())
    return await action.execute(context)
}
