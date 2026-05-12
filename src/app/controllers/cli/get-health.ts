import type { GlobalCliOptions } from '@/app/dto/cli/options'
import { getProjectStatus } from '@/app/providers/file-system/status'
import { terminal } from '@/app/support/terminal'

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
