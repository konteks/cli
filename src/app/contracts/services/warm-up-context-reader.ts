import type { WarmUpContext } from '@/models/memory'
import type { Project } from '@/models/project'

export interface WarmUpContextReaderContract {
    read(project: Project): Promise<WarmUpContext>
}
