import { projectMemoryDatabasePath } from '@/database/services/project-memory'
import {
    type ProjectMemoryStats,
    readProjectMemoryStats,
} from '@/database/services/project-status'
import { getExtractionFreshness } from '@/modules/extraction/engine/manifest'
import { loadProjectContext, pathExists } from '@/modules/project/context'
import { formatInteger } from '@/support/format/number'
import {
    type BannerHeaderTheme,
    colorRgb,
    createBannerHeaderTheme,
    formatBannerHeader,
} from '@/support/tui/components'
import type { Project } from '@/types/project'
import BaseCommand from './_base-command'

export default class StatusCommand extends BaseCommand {
    public readonly description =
        'Print Konteks project memory status for humans.'
    public readonly name = 'status'
    public override readonly printsHeader = false

    public async handle(): Promise<void> {
        const theme = createBannerHeaderTheme()
        const context = await loadProjectContext()
        const statusReader = new ProjectStatusReader()

        const status = await statusReader.read(context)

        this.consoleOutput
            .print(formatBannerHeader(theme))
            .print(formatStatus(status, theme))
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

function formatStatus(status: ProjectStatus, theme: BannerHeaderTheme): string {
    const statusDetail = formatStatusDetail(status)

    const lines = [
        '',
        row('Project', status.projectRoot, theme),
        row('Memory', status.memoryDir, theme),
        '',
        row('Status', statusDetail, theme),
        row('Last indexed', formatLastIndexed(status), theme),
        '',
        row('Source files', formatInteger(status.memoryStats.files), theme),
        row('Vectors', formatInteger(status.memoryStats.embeddings), theme),
        '',
        semanticColor('warning', '  DERIVED MEMORY'),
        nestedRow('Modules', formatInteger(status.memoryStats.modules), theme),
        nestedRow(
            'Sections',
            formatInteger(status.memoryStats.sections),
            theme,
        ),
        '',
        semanticColor('warning', '  DURABLE MEMORY'),
        nestedRow(
            'Memories',
            formatInteger(status.memoryStats.memories),
            theme,
        ),
        nestedRow(
            'Diary entries',
            formatInteger(status.memoryStats.diaryEntries),
            theme,
        ),
        '',
    ].filter(line => line !== undefined)

    return lines.join('\n')
}

function row(label: string, value: string, theme: BannerHeaderTheme): string {
    return `  ${colorRgb(theme.primary, label.padEnd(13))} ${value}`
}

function nestedRow(
    label: string,
    value: string,
    theme: BannerHeaderTheme,
): string {
    return `  ${colorRgb(theme.primary, label.padEnd(13))} ${value}`
}

function formatStatusDetail(status: ProjectStatus): string {
    if (status.freshness.status === 'missing') {
        return semanticColor('danger', 'NOT INITIALIZED')
    }

    if (
        status.freshness.status === 'stale' ||
        status.freshness.changedFileCount > 0
    ) {
        return semanticColor('warning', 'STALE')
    }

    return 'up-to-date'
}

function semanticColor(name: 'danger' | 'warning', value: string): string {
    if (process.env.NO_COLOR) {
        return value
    }

    const code = name === 'danger' ? 31 : 33

    return `\u001b[${code}m${value}\u001b[0m`
}

function formatLastIndexed(status: ProjectStatus): string {
    return status.freshness.lastExtractedAt
        ? formatDate(status.freshness.lastExtractedAt)
        : 'Not indexed yet'
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
