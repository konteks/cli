import { getProjectStatus } from '@/infrastructure/file-system/status'
import type { GlobalCliOptions } from '@/interfaces/cli/options'

export async function getHealthCommand(
    options: GlobalCliOptions,
): Promise<void> {
    const status = await getProjectStatus(options.project)
    const checks = [
        ['projectRoot', Boolean(status.projectRoot)],
        ['memoryDir', status.memoryDirExists],
        ['config', status.configExists],
    ] as const

    console.log(
        JSON.stringify(
            { checks, ok: checks.every(([, ok]) => ok), status },
            null,
            2,
        ),
    )
}
