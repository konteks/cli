import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from '@/contracts/services/project-status-reader'
import { loadProjectContext } from '@/providers/project/context'
import ProjectStatusReader from '@/providers/project/project-status-reader'

export type { ProjectStatus }

export type ReadProjectStatusOptions = {
    statusReader?: ProjectStatusReaderContract
}

export default async function readProjectStatus(
    options: ReadProjectStatusOptions = {},
): Promise<ProjectStatus> {
    const context = await loadProjectContext()
    const statusReader = options.statusReader ?? new ProjectStatusReader()
    return await statusReader.read(context)
}
