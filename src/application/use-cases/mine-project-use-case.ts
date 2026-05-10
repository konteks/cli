import type { IProjectRepository } from '@/domain/repositories/project-repository.js'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '../dto/mine-project.js'
import type { IMineEngine } from '../interfaces/mine-engine.js'

export class MineProjectUseCase {
    constructor(
        private readonly projectRepository: IProjectRepository,
        private readonly mineEngine: IMineEngine,
    ) {}

    async execute(request: MineProjectRequest): Promise<MineProjectResponse> {
        const project = await this.projectRepository.getProject(
            request.projectRoot,
        )
        return await this.mineEngine.mine(project, request)
    }
}
