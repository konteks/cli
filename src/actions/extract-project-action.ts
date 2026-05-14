import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'

export class ExtractProjectAction {
    constructor(private readonly extractionEngine: ExtractionEngineContract) {}

    async execute(
        project: Project,
        request: ExtractProjectRequest,
    ): Promise<ExtractProjectResponse> {
        return await this.extractionEngine.extract(project, request)
    }
}
