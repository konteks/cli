import type { Project, ProjectContext } from '../entities/project.js'

export interface IProjectRepository {
    getProject(rootPath: string): Promise<Project>
    saveProjectContext(context: ProjectContext): Promise<void>
}
