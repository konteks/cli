import type { MineEngineContract } from '@/app/contracts/services/mine-engine'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '@/app/models/mining'
import type { Project } from '@/app/models/project'

export class MineProjectAction {
    constructor(private readonly mineEngine: MineEngineContract) {}

    async execute(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse> {
        return await this.mineEngine.mine(project, request)
    }
}
