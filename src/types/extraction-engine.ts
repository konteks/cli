import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/types/extraction'
import type { Project } from '@/types/project'

export interface ExtractionEngineContract {
    extract(
        project: Project,
        request: ExtractProjectRequest,
    ): Promise<ExtractProjectResponse>
}
