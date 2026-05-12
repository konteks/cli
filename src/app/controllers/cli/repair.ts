import type { MineMode } from '@/app/dto/application/mine-project'
import type { GlobalCliOptions } from '@/app/dto/cli/options'
import { confirmInteractive, stringifyPretty, terminal } from '@/app/services'
import {
    createMineProgressReporter,
    createMiningAction,
} from '@/app/services/mining'

type MineOptions = {
    changed?: boolean
    reindex?: boolean
}

export async function repairCommand(options: GlobalCliOptions): Promise<void> {
    await mineCommand(options, { reindex: true })
}

async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const mode = mineMode(mineOptions)

    if (mode === 'reindex' && !(await confirmRepair())) {
        printMineResult({ mode: 'repair', ok: false, skipped: true })
        return
    }

    const progress = createMineProgressReporter()
    try {
        const action = createMiningAction({
            onProgress: progress.report,
        })

        const result = await action.execute({
            mode: mode as MineMode,
            projectRoot: options.project || process.cwd(),
        })

        printMineResult({
            ...result,
            mode: result.mode === 'reindex' ? 'repair' : result.mode,
        })
    } finally {
        progress.done()
    }
}

function mineMode(options: MineOptions): 'changed' | 'full' | 'reindex' {
    if (options.changed && options.reindex) {
        throw new Error('Use either changed or repair mode, not both.')
    }

    if (options.reindex) {
        return 'reindex'
    }

    if (options.changed) {
        return 'changed'
    }

    return 'full'
}

async function confirmRepair(): Promise<boolean> {
    return await confirmInteractive(
        'Repair Konteks memory by rebuilding artifacts for this project?',
        true,
    )
}

function printMineResult(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
