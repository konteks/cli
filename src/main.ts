#!/usr/bin/env node
import { Command } from 'commander'
import { callMcpToolCommand } from '@/controllers/call-mcp-tool'
import { configCommand } from '@/controllers/config'
import { getPromptDetailCommand } from '@/controllers/get-prompt-detail'
import { getPromptsCommand } from '@/controllers/get-prompts'
import { getStatusCommand } from '@/controllers/get-status'
import { getToolDetailCommand } from '@/controllers/get-tool-detail'
import { getToolsCommand } from '@/controllers/get-tools'
import { initCommand } from '@/controllers/init'
import { installSkillsCommand } from '@/controllers/install-skills'
import {
    backupMemoryCommand,
    exportMemoryCommand,
    importMemoryCommand,
    restoreMemoryCommand,
} from '@/controllers/memory-transfer'
import { repairCommand } from '@/controllers/repair'
import { startMcpServer } from '@/controllers/serve-mcp'
import { ensureCliProjectInitialized } from '@/middlewares/cli-initialization'
import type { GlobalCliOptions } from '@/models/cli'
import { printCliError } from '@/support/cli/error-output'
import { terminal } from '@/support/terminal/service'
import { VERSION } from '@/support/version'

type McpCallOptions = {
    apply?: boolean
    json?: boolean
}

type InstallSkillOptions = GlobalCliOptions & {
    global?: boolean
}

type InitOptions = GlobalCliOptions & {
    grammar?: string[]
}

type MemoryExportOptions = GlobalCliOptions & {
    includeInactive?: boolean
}

type MemoryImportOptions = GlobalCliOptions & {
    dryRun?: boolean
}

type RestoreOptions = GlobalCliOptions & {
    force?: boolean
}

type CliCommandHandlers = {
    backupMemory: (
        options: GlobalCliOptions,
        outputPath: string,
    ) => Promise<void>
    callMcpTool: (
        options: GlobalCliOptions,
        name: string,
        jsonInput?: string,
        callOptions?: McpCallOptions,
    ) => Promise<void>
    exportMemory: (
        options: MemoryExportOptions,
        outputPath: string,
    ) => Promise<void>
    getPromptDetail: (name: string, input?: string) => Promise<void>
    getPrompts: () => Promise<void>
    getStatus: (options: GlobalCliOptions) => Promise<void>
    getToolDetail: (name: string) => Promise<void>
    getTools: () => Promise<void>
    importMemory: (
        options: MemoryImportOptions,
        inputPath: string,
    ) => Promise<void>
    init: (options: InitOptions) => Promise<void>
    installSkills: (options: InstallSkillOptions) => Promise<void>
    repair: (options: GlobalCliOptions) => Promise<void>
    restoreMemory: (options: RestoreOptions, inputPath: string) => Promise<void>
    startMcpServer: (options: GlobalCliOptions) => Promise<void>
}

type CreateCliProgramOptions = {
    ensureInitialized?: (project?: string) => Promise<void>
    handlers?: Partial<CliCommandHandlers>
}

function createCliProgram(options: CreateCliProgramOptions = {}): Command {
    const handlers = {
        backupMemory: backupMemoryCommand,
        callMcpTool: callMcpToolCommand,
        exportMemory: exportMemoryCommand,
        getPromptDetail: getPromptDetailCommand,
        getPrompts: getPromptsCommand,
        getStatus: getStatusCommand,
        getToolDetail: getToolDetailCommand,
        getTools: getToolsCommand,
        importMemory: importMemoryCommand,
        init: initCommand,
        installSkills: installSkillsCommand,
        repair: repairCommand,
        restoreMemory: restoreMemoryCommand,
        startMcpServer,
        ...options.handlers,
    }
    const ensureInitialized =
        options.ensureInitialized ?? ensureCliProjectInitialized

    const program = new Command()
        .name('konteks')
        .description(
            `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
        )
        .version(VERSION)
        .option('--project <path>', 'Project root override')

    program.hook('preAction', async (_command, actionCommand) => {
        if (shouldPrintCliHeader(actionCommand.name())) {
            terminal.log(`Konteks v${VERSION}`)
        }

        if (new Set(['init', 'restore']).has(actionCommand.name())) {
            return
        }

        await ensureInitialized(program.opts().project)
    })

    program
        .command('init')
        .description(
            'Initialize memory, section the project, and build indexes.',
        )
        .option(
            '--grammar <id>',
            'Select a Tree-sitter grammar during non-interactive init; repeatable.',
            collectValues,
        )
        .action(async (initOptions: { grammar?: string[] }) => {
            await handlers.init({ ...program.opts(), ...initOptions })
        })

    program
        .command('config')
        .description('Configure project-local Konteks settings.')
        .action(async () => {
            await configCommand(program.opts())
        })

    program
        .command('status')
        .description('Print Konteks project memory status for humans.')
        .action(async () => {
            await handlers.getStatus(program.opts())
        })

    program
        .command('repair')
        .description(
            'Repair Konteks memory by rebuilding artifacts from scratch.',
        )
        .action(async () => {
            await handlers.repair(program.opts())
        })

    const memory = program
        .command('memory')
        .description('Import or export portable durable memory.')

    memory
        .command('export')
        .description('Export durable memories and diary entries to JSON.')
        .argument('<file>', 'Output JSON file')
        .option(
            '--include-inactive',
            'Include soft-deleted or suppressed durable memory.',
        )
        .action(
            async (
                outputPath: string,
                memoryOptions: { includeInactive?: boolean },
            ) => {
                await handlers.exportMemory(
                    { ...program.opts(), ...memoryOptions },
                    outputPath,
                )
            },
        )

    memory
        .command('import')
        .description('Import durable memories and diary entries from JSON.')
        .argument('<file>', 'Input JSON file')
        .option('--dry-run', 'Validate and report counts without writing.')
        .action(
            async (inputPath: string, memoryOptions: { dryRun?: boolean }) => {
                await handlers.importMemory(
                    { ...program.opts(), ...memoryOptions },
                    inputPath,
                )
            },
        )

    program
        .command('backup')
        .description('Create a full .konteks backup archive.')
        .argument('<file>', 'Output .tar.gz file')
        .action(async (outputPath: string) => {
            await handlers.backupMemory(program.opts(), outputPath)
        })

    program
        .command('restore')
        .description('Restore a full .konteks backup archive.')
        .argument('<file>', 'Input .tar.gz file')
        .option('--force', 'Replace a non-empty memory directory.')
        .action(
            async (inputPath: string, restoreOptions: { force?: boolean }) => {
                await handlers.restoreMemory(
                    { ...program.opts(), ...restoreOptions },
                    inputPath,
                )
            },
        )

    const mcp = program
        .command('mcp')
        .description('Start the MCP server or run MCP debug commands.')
        .action(async () => {
            await handlers.startMcpServer({ project: program.opts().project })
        })

    mcp.command('tools')
        .description('List MCP tools exposed by Konteks.')
        .action(async () => {
            await handlers.getTools()
        })

    mcp.command('tool')
        .description('Show one MCP tool exposed by Konteks.')
        .argument('<name>', 'MCP tool name, such as konteks_warm_up')
        .action(async (name: string) => {
            await handlers.getToolDetail(name)
        })

    mcp.command('prompts')
        .description('List MCP prompts exposed by Konteks.')
        .action(async () => {
            await handlers.getPrompts()
        })

    mcp.command('prompt')
        .description('Render one MCP prompt for debugging.')
        .argument('<name>', 'MCP prompt name, such as konteks-warm-up')
        .argument(
            '[input...]',
            'Optional JSON prompt arguments or free-form warm-up topic',
        )
        .action(async (name: string, input?: string[]) => {
            await handlers.getPromptDetail(name, input?.join(' '))
        })

    mcp.command('call')
        .description('Preview or call one MCP tool for debugging.')
        .option('--apply', 'Actually execute mutating MCP tools.')
        .option('--json', 'Print the raw MCP result envelope as JSON.')
        .argument('<tool>', 'MCP tool name, such as konteks_warm_up')
        .argument('[json]', 'Optional JSON tool input')
        .action(
            async (
                name: string,
                jsonInput?: string,
                callOptions?: McpCallOptions,
            ) => {
                await handlers.callMcpTool(
                    program.opts(),
                    name,
                    jsonInput,
                    callOptions,
                )
            },
        )

    program
        .command('install-skills')
        .description('Install Konteks skills for agents without MCP prompts.')
        .option('--global', 'Install into ~/.agents/skills')
        .action(async (installOptions: { global?: boolean }) => {
            await handlers.installSkills({
                ...program.opts(),
                ...installOptions,
            })
        })

    return program
}

function collectValues(value: string, previous: string[]): string[] {
    return [...previous, value]
}

function shouldPrintCliHeader(commandName: string): boolean {
    return new Set([
        'backup',
        'config',
        'export',
        'import',
        'init',
        'install-skills',
        'repair',
        'restore',
        'status',
    ]).has(commandName)
}

createCliProgram()
    .parseAsync(process.argv)
    .catch(error => {
        printCliError(error)
        process.exitCode = 1
    })
