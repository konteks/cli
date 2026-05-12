import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from '@/app/contracts/services/project-status-reader'
import type { Project } from '@/app/models/project'

export class ProjectStatusAction {
    constructor(private readonly statusReader: ProjectStatusReaderContract) {}

    async execute(project: Project): Promise<ProjectStatus> {
        return await this.statusReader.read(project)
    }
}

export type { ProjectStatus }
