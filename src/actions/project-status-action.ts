import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from '@/contracts/services/project-status-reader'
import type { Project } from '@/models/project'

export class ProjectStatusAction {
    constructor(private readonly statusReader: ProjectStatusReaderContract) {}

    async execute(project: Project): Promise<ProjectStatus> {
        return await this.statusReader.read(project)
    }
}

export type { ProjectStatus }
