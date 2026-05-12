import type { Project, ProjectContext } from '@/app/models/project'

export interface ProjectRepositoryContract {
    getProject(rootPath: string): Promise<Project>
    saveProjectContext(context: ProjectContext): Promise<void>
}
