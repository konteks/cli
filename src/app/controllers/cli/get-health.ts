import type { GlobalCliOptions } from '@/app/dto/cli/options'
import { terminal } from '@/app/services'
import { getProjectStatus } from '@/app/services/file-system/status'

export async function getHealthCommand(
    options: GlobalCliOptions,
): Promise<void> {
    const status = await getProjectStatus(options.project)
    const checks = [
        ['projectRoot', Boolean(status.projectRoot)],
        ['memoryDir', status.memoryDirExists],
        ['config', status.configExists],
    ] as const

    terminal.log(
        JSON.stringify(
            { checks, ok: checks.every(([, ok]) => ok), status },
            null,
            2,
        ),
    )
}
