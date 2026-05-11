import type { Project } from '@/domain/entities/project'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '../dto/mine-project'

export interface IMineEngine {
    mine(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse>
}
