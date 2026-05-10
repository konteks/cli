import type { Project } from '../../domain/entities/project.js'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '../dto/mine-project.js'

export interface IMineEngine {
    mine(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse>
}
