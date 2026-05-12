import type {
    MineProjectRequest,
    MineProjectResponse,
} from '@/app/dto/application/mine-project'
import type { Project } from '@/app/models/project'

export interface MineEngineContract {
    mine(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse>
}
