import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from '@/contracts/services/project-status-reader'
import { loadProjectContext } from '@/providers/project/context'
import { ProjectStatusReader } from '@/providers/project/status-reader'

export type { ProjectStatus }

export type ReadProjectStatusOptions = {
    statusReader?: ProjectStatusReaderContract
}

export async function readProjectStatus(
    projectOverride?: string,
    options: ReadProjectStatusOptions = {},
): Promise<ProjectStatus> {
    const context = await loadProjectContext(projectOverride)
    const statusReader = options.statusReader ?? new ProjectStatusReader()
    return await statusReader.read(context)
}
