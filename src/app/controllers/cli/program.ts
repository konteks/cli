import { callMcpToolCommand } from '@/app/controllers/cli/call-mcp-tool'
import { getPromptDetailCommand } from '@/app/controllers/cli/get-prompt-detail'
import { getPromptsCommand } from '@/app/controllers/cli/get-prompts'
import { getStatusCommand } from '@/app/controllers/cli/get-status'
import { getToolDetailCommand } from '@/app/controllers/cli/get-tool-detail'
import { getToolsCommand } from '@/app/controllers/cli/get-tools'
import { initCommand } from '@/app/controllers/cli/init'
import { installSkillsCommand } from '@/app/controllers/cli/install-skills'
import { repairCommand } from '@/app/controllers/cli/repair'
import type { GlobalCliOptions } from '@/app/controllers/cli/types'
import { startMcpServer } from '@/app/controllers/mcp/serve'
import { ensureCliProjectInitialized } from '@/app/middlewares/cli-initialization'
import { Command } from '@/app/support/cli'
import { VERSION } from '@/app/support/version'

type McpCallOptions = {
    apply?: boolean
    json?: boolean
}

type InstallSkillOptions = GlobalCliOptions & {
    global?: boolean
}

type CliCommandHandlers = {
    callMcpTool: (
        options: GlobalCliOptions,
        name: string,
        jsonInput?: string,
        callOptions?: McpCallOptions,
    ) => Promise<void>
    getPromptDetail: (name: string, input?: string) => Promise<void>
    getPrompts: () => Promise<void>
    getStatus: (options: GlobalCliOptions) => Promise<void>
    getToolDetail: (name: string) => Promise<void>
    getTools: () => Promise<void>
    init: (options: GlobalCliOptions) => Promise<void>
    installSkills: (options: InstallSkillOptions) => Promise<void>
    repair: (options: GlobalCliOptions) => Promise<void>
    startMcpServer: (options: GlobalCliOptions) => Promise<void>
}

type CreateCliProgramOptions = {
    ensureInitialized?: (project?: string) => Promise<void>
    handlers?: Partial<CliCommandHandlers>
}

export function createCliProgram(
    options: CreateCliProgramOptions = {},
): Command {
    const handlers = {
        callMcpTool: callMcpToolCommand,
        getPromptDetail: getPromptDetailCommand,
        getPrompts: getPromptsCommand,
        getStatus: getStatusCommand,
        getToolDetail: getToolDetailCommand,
        getTools: getToolsCommand,
        init: initCommand,
        installSkills: installSkillsCommand,
        repair: repairCommand,
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
        if (actionCommand.name() === 'init') {
            return
        }

        await ensureInitialized(program.opts().project)
    })

    program
        .command('init')
        .description(
            'Initialize memory, section the project, and build indexes.',
        )
        .action(async () => {
            await handlers.init(program.opts())
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
