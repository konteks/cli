import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'

export interface ExtractionEngineContract {
    extract(
        project: Project,
        request: ExtractProjectRequest,
    ): Promise<ExtractProjectResponse>
}
