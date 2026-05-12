import type { MineProjectRequest, MineProjectResponse } from '@/models/mining'
import type { Project } from '@/models/project'

export interface MineEngineContract {
    mine(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse>
}
