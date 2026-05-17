import BaseCommand from '@/commands/_base-command'
import type { Project } from '@/models/project'
import { getExtractionFreshness } from '@/providers/extraction/engine/manifest'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/providers/extraction/engine/source-types'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '@/providers/persistence/sqlite/database'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import type { SqliteParams } from '@/providers/persistence/sqlite/sqlite-adapter'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { formatInteger } from '@/support/format/number'
import createColorPalette, {
    type ColorPalette,
} from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'
import { VERSION } from '@/support/version'

export default class StatusCommand extends BaseCommand {
    public readonly description =
        'Print Konteks project memory status for humans.'
    public readonly name = 'status'

    public async handle(): Promise<void> {
        const status = await readProjectStatus()

        this.print(
            formatStatus(status, {
                color: createColorPalette(terminal.stdoutSupportsColor()),
                version: VERSION,
            }),
        )
    }
}

type ProjectStatus = {
    projectRoot: string
    memoryDir: string
    memoryDirExists: boolean
    configExists: boolean
    databasePath: string
    databaseExists: boolean
    memoryStats: {
        files: number
        sections: number
        modules: number
        memories: number
        diaryEntries: number
        retrievalDocuments: number
        embeddings: number
        events: number
    }
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

type ReadProjectStatusOptions = {
    statusReader?: ProjectStatusReaderContract
}

async function readProjectStatus(
    options: ReadProjectStatusOptions = {},
): Promise<ProjectStatus> {
    const context = await loadProjectContext()
    const statusReader = options.statusReader ?? new ProjectStatusReader()
    return await statusReader.read(context)
}

type StatusColorPalette = Pick<ColorPalette, 'accent' | 'dim' | 'success'>

function formatStatus(
    status: ProjectStatus,
    options: { color?: StatusColorPalette; version?: string } = {},
): string {
    const color = options.color ?? createColorPalette(false)
    const changedFiles = status.freshness.changedFileCount
    const version = options.version ?? VERSION
    const lines = [
        '',
        `${color.accent('Konteks Memory')} ${color.dim(`v${version}`)}`,
        color.dim('-'.repeat(48)),
        row('Project', status.projectRoot),
        row('Memory', status.memoryDir),
        row('Freshness', formatFreshness(status, changedFiles)),
        '',
        anchoredStat(
            color,
            'Knowledge',
            [
                compactStat('files', status.memoryStats.files, color),
                compactStat('sections', status.memoryStats.sections, color),
                compactStat('modules', status.memoryStats.modules, color),
            ].join(', '),
        ),
        anchoredStat(
            color,
            'Session Memory',
            [
                compactStat('memories', status.memoryStats.memories, color),
                compactStat(
                    'diary entries',
                    status.memoryStats.diaryEntries,
                    color,
                ),
            ].join(', '),
        ),
        anchoredStat(
            color,
            'Retrieval',
            [
                compactStat(
                    'documents',
                    status.memoryStats.retrievalDocuments,
                    color,
                ),
                compactStat('vectors', status.memoryStats.embeddings, color),
            ].join(', '),
        ),
        '',
    ]

    return lines.join('\n')
}

function row(label: string, value: string): string {
    return `${label.padEnd(10)} ${value}`
}

function anchoredStat(
    color: StatusColorPalette,
    label: string,
    value: string,
): string {
    return `${color.accent(label.padEnd(14))} ${value}`
}

function compactStat(
    label: string,
    value: number,
    color: StatusColorPalette,
): string {
    return `${color.success(formatInteger(value))} ${label}`
}

function formatCount(value: number, singular: string): string {
    return `${formatInteger(value)} ${singular}${value === 1 ? '' : 's'}`
}

function formatFreshness(status: ProjectStatus, changedFiles: number): string {
    if (status.freshness.status === 'missing') {
        const recommendation = status.freshness.recommendedCommand
            ? `; run ${status.freshness.recommendedCommand}`
            : ''
        return `${status.freshness.reason}${recommendation}`
    }

    const lastExtracted = status.freshness.lastExtractedAt
        ? formatDate(status.freshness.lastExtractedAt)
        : 'Not extracted yet'

    if (changedFiles > 0) {
        return `${lastExtracted}; ${formatCount(changedFiles, 'file')} changed; indexed during warm up/save`
    }

    return `${lastExtracted}; no file changes`
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
        const databasePath = projectDatabasePath(context)
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
                ? await readMemoryStats(context)
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

async function readMemoryStats(
    context: Project,
): Promise<ProjectStatus['memoryStats']> {
    const service = await openProjectDatabase(context)
    try {
        const [
            files,
            sections,
            modules,
            memories,
            diaryEntries,
            retrievalDocuments,
            embeddings,
            events,
        ] = await Promise.all([
            countRows(
                service,
                'select count(*) as count from sources where type = ?',
                [EXTRACTED_FILE_SOURCE_TYPE],
            ),
            countRows(
                service,
                'select count(*) as count from chunks where deleted_at is null and suppressed_at is null',
            ),
            countRows(service, 'select count(*) as count from modules'),
            countRows(
                service,
                'select count(*) as count from observations where deleted_at is null and suppressed_at is null',
            ),
            countRows(
                service,
                'select count(*) as count from diary_entries where deleted_at is null and suppressed_at is null',
            ),
            countRows(
                service,
                'select count(*) as count from retrieval_documents',
            ),
            countRows(
                service,
                'select count(*) as count from target_embeddings',
            ),
            countRows(service, 'select count(*) as count from memory_events'),
        ])

        return {
            diaryEntries,
            embeddings,
            events,
            files,
            memories,
            modules,
            retrievalDocuments,
            sections,
        }
    } finally {
        await service.close()
    }
}

async function countRows(
    service: DatabaseService,
    sql: string,
    params: SqliteParams = [],
): Promise<number> {
    const rows = await service.adapter.query<{ count: number }>(sql, params)
    return rows[0]?.count ?? 0
}
