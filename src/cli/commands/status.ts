import { getProjectStatus } from '../../project/status.js'
import type { GlobalCliOptions } from '../options.js'

export async function statusCommand(options: GlobalCliOptions): Promise<void> {
    const status = await getProjectStatus(options.project)
    console.log(JSON.stringify(status, null, 2))
}
