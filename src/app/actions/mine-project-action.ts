import type { ProjectRepositoryContract } from '@/app/contracts/repositories/project-repository'
import type { MineEngineContract } from '@/app/contracts/services/mine-engine'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '@/app/dto/application/mine-project'

export class MineProjectAction {
    constructor(
        private readonly projectRepository: ProjectRepositoryContract,
        private readonly mineEngine: MineEngineContract,
    ) {}

    async execute(request: MineProjectRequest): Promise<MineProjectResponse> {
        const project = await this.projectRepository.getProject(
            request.projectRoot,
        )
        return await this.mineEngine.mine(project, request)
    }
}
