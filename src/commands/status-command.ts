import BaseCommand from '@/commands/_base-command'
import { projectMemoryDatabasePath } from '@/database/services/project-memory'
import {
    type ProjectMemoryStats,
    readProjectMemoryStats,
} from '@/database/services/project-status'
import { getExtractionFreshness } from '@/providers/extraction/engine/manifest'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { formatInteger } from '@/support/format/number'
import createColorPalette, {
    type ColorPalette,
} from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'
import type { Project } from '@/types/project'

export default class StatusCommand extends BaseCommand {
    public readonly description =
        'Print Konteks project memory status for humans.'
    public readonly name = 'status'

    public async handle(): Promise<void> {
        const context = await loadProjectContext()
        const statusReader = new ProjectStatusReader()

        const status = await statusReader.read(context)

        this.print(formatStatus(status))
    }
}

type ProjectStatus = {
    projectRoot: string
    memoryDir: string
    memoryDirExists: boolean
    configExists: boolean
    databasePath: string
    databaseExists: boolean
    memoryStats: ProjectMemoryStats
    freshness: {
        status: 'missing' | 'fresh' | 'stale'
        reason: string
        changedFileCount: number
        lastExtractedAt?: string
        recommendedCommand?: string
    }
}

interface ProjectStatusReaderContract {
    read(project: Project): Promise<ProjectStatus>
}

type StatusColorPalette = Pick<
    ColorPalette,
    'accent' | 'danger' | 'dim' | 'success' | 'warning'
>

function formatStatus(status: ProjectStatus): string {
    const color = createColorPalette(terminal.stdoutSupportsColor())
    const statusDetail = formatStatusDetail(status, color)

    const lines = [
        '',
        color.accent('Project memory status'),
        '',
        row('Project', status.projectRoot),
        row('Memory', status.memoryDir),
        '',
        row('Status', statusDetail),
        row('Last indexed', formatLastIndexed(status)),
        '',
        row('Source files', formatInteger(status.memoryStats.files)),
        '',
        color.accent('Project memory'),
        nestedRow(
            'Documents',
            `${formatInteger(status.memoryStats.retrievalDocuments)} (${formatCount(status.memoryStats.sections, 'section')}, ${formatCount(status.memoryStats.modules, 'module')})`,
        ),
        nestedRow('Vectors', formatInteger(status.memoryStats.embeddings)),
        '',
        color.accent('Session memory'),
        nestedRow('Memories', formatInteger(status.memoryStats.memories)),
        nestedRow(
            'Diary entries',
            formatInteger(status.memoryStats.diaryEntries),
        ),
        '',
    ].filter(line => line !== undefined)

    return lines.join('\n')
}

function row(label: string, value: string): string {
    return `${label.padEnd(13)} ${value}`
}

function nestedRow(label: string, value: string): string {
    return `  ${label.padEnd(15)} ${value}`
}

function formatStatusDetail(
    status: ProjectStatus,
    color: StatusColorPalette,
): string {
    if (status.freshness.status === 'missing') {
        return color.danger('Not initialized')
    }

    if (
        status.freshness.status === 'stale' ||
        status.freshness.changedFileCount > 0
    ) {
        return color.warning('Needs indexing')
    }

    return color.success('Up to date')
}

function formatLastIndexed(status: ProjectStatus): string {
    return status.freshness.lastExtractedAt
        ? formatDate(status.freshness.lastExtractedAt)
        : 'Not indexed yet'
}

function formatCount(value: number, singular: string): string {
    return `${formatInteger(value)} ${singular}${value === 1 ? '' : 's'}`
}

function formatDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}

class ProjectStatusReader implements ProjectStatusReaderContract {
    public async read(context: Project): Promise<ProjectStatus> {
        const databasePath = projectMemoryDatabasePath(context)
        const memoryDirExists = await pathExists(context.memoryDir)
        const databaseExists = await pathExists(databasePath)
        const initialized = memoryDirExists && context.configExists

        return {
            configExists: context.configExists,
            databaseExists,
            databasePath,
            freshness: initialized
                ? await getExtractionFreshness(context)
                : {
                      changedFileCount: 0,
                      reason: 'Konteks project memory is not initialized.',
                      recommendedCommand: 'konteks init',
                      status: 'missing',
                  },
            memoryDir: context.memoryDir,
            memoryDirExists,
            memoryStats: databaseExists
                ? await readProjectMemoryStats()
                : emptyMemoryStats(),
            projectRoot: context.projectRoot,
        }
    }
}

function emptyMemoryStats(): ProjectStatus['memoryStats'] {
    return {
        diaryEntries: 0,
        embeddings: 0,
        events: 0,
        files: 0,
        memories: 0,
        modules: 0,
        retrievalDocuments: 0,
        sections: 0,
    }
}
