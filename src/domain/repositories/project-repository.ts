import type { Project, ProjectContext } from '../entities/project'

export interface IProjectRepository {
    getProject(rootPath: string): Promise<Project>
    saveProjectContext(context: ProjectContext): Promise<void>
}
