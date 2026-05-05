import { HuggingFaceEmbeddingProvider } from '../../mining/embedding-provider.js'
import { mineProject } from '../../mining/mine-project.js'
import type { MineProgressEvent } from '../../mining/progress.js'
import { loadProjectContext } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'
import { confirmInteractive } from '../prompts.js'

type MineOptions = {
    changed?: boolean
    reindex?: boolean
}

export async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const context = await loadProjectContext(options.project)
    if (mineOptions.changed && mineOptions.reindex) {
        throw new Error('Use either --changed or --reindex, not both.')
    }

    const mode = mineOptions.reindex
        ? 'reindex'
        : mineOptions.changed
          ? 'changed'
          : 'full'
    if (
        mode === 'reindex' &&
        !(await confirmInteractive(
            'Rebuild all Konteks mining artifacts for this project?',
            true,
        ))
    ) {
        console.log(JSON.stringify({ mode, ok: false, skipped: true }, null, 2))
        return
    }

    const progress = createMineProgressReporter()
    try {
        const result = await mineProject(context, mode, {
            embeddingProvider: new HuggingFaceEmbeddingProvider(),
            onProgress: progress.report,
        })

        console.log(JSON.stringify(result, null, 2))
    } finally {
        progress.done()
    }
}

function createMineProgressReporter(): {
    done(): void
    report(event: MineProgressEvent): void
} {
    let lastLength = 0
    let lastPhase = ''
    const isTty = process.stderr.isTTY

    return {
        done() {
            if (isTty && lastLength > 0) {
                process.stderr.write('\n')
            }
        },
        report(event) {
            const message = formatProgressEvent(event)
            if (!message) {
                return
            }

            if (!isTty) {
                if (event.status !== 'progress' || event.phase !== lastPhase) {
                    console.error(`[mine] ${message}`)
                    lastPhase = event.phase
                }
                return
            }

            const output = `[mine] ${message}`
            const padding = Math.max(0, lastLength - output.length)
            process.stderr.write(`\r${output}${' '.repeat(padding)}`)
            lastLength = output.length

            if (event.status === 'done') {
                process.stderr.write('\n')
                lastLength = 0
            }
        },
    }
}

function formatProgressEvent(event: MineProgressEvent): string {
    const prefix = event.total
        ? `[${event.current ?? event.total}/${event.total}] `
        : ''
    const suffix =
        event.embeddedCount !== undefined &&
        event.phase === 'embeddings' &&
        event.status === 'progress'
            ? ` (${event.embeddedCount} embedded, ${event.reusedCount ?? 0} reused)`
            : ''

    return `${prefix}${event.message ?? event.phase}${suffix}`
}
