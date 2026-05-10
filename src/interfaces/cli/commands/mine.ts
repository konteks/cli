import type { MineMode } from '@/application/dto/mine-project.js'
import { MineProjectUseCase } from '@/application/use-cases/mine-project-use-case.js'
import { HuggingFaceEmbeddingProvider } from '../../../infrastructure/ai/hugging-face-embedding-provider.js'
import { FileSystemProjectRepository } from '../../../infrastructure/file-system/file-system-project-repository.js'
import { KonteksMineEngine } from '../../../infrastructure/mining/mine-project.js'
import { stringifyPretty } from '../../../utils/json.js'
import { confirmInteractive } from '../../../utils/prompts.js'
import type { GlobalCliOptions } from '../options.js'
import { createMineProgressReporter } from './mine-progress.js'

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
        const embeddingProvider = new HuggingFaceEmbeddingProvider({
            onProgress: progress.report,
        })
        const projectRepo = new FileSystemProjectRepository()
        const mineEngine = new KonteksMineEngine({
            embeddingProvider,
            onProgress: progress.report,
        })
        const useCase = new MineProjectUseCase(projectRepo, mineEngine)

        const result = await useCase.execute({
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
    console.log(stringifyPretty(value))
}

export { createMineProgressReporter }
