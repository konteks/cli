import { ProjectStatusAction } from '@/actions/project-status-action'
import type { ProjectStatus } from '@/contracts/services/project-status-reader'
import { loadProjectContext } from '@/providers/project/context'
import { ProjectStatusReader } from '@/providers/project/status-reader'

export async function readProjectStatus(
    projectOverride?: string,
): Promise<ProjectStatus> {
    const context = await loadProjectContext(projectOverride)
    const action = new ProjectStatusAction(new ProjectStatusReader())
    return await action.execute(context)
}
