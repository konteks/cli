import type { WarmUpContext } from '@/app/models/memory'
import type { Project } from '@/app/models/project'

export interface WarmUpContextReaderContract {
    read(project: Project): Promise<WarmUpContext>
}
