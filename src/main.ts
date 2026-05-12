#!/usr/bin/env node
import { callMcpToolCommand } from '@/app/controllers/cli/call-mcp-tool'
import { getHealthCommand } from '@/app/controllers/cli/get-health'
import { getPromptDetailCommand } from '@/app/controllers/cli/get-prompt-detail'
import { getPromptsCommand } from '@/app/controllers/cli/get-prompts'
import { getStatusCommand } from '@/app/controllers/cli/get-status'
import { getToolDetailCommand } from '@/app/controllers/cli/get-tool-detail'
import { getToolsCommand } from '@/app/controllers/cli/get-tools'
import { initCommand } from '@/app/controllers/cli/init'
import { installSkillsCommand } from '@/app/controllers/cli/install-skills'
import { repairCommand } from '@/app/controllers/cli/repair'
import { startMcpServer } from '@/app/controllers/mcp/serve'
import { Command } from '@/app/support/cli'
import { VERSION } from '@/app/support/version'

const program = new Command()
    .name('konteks')
    .description(
        `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
    )
    .version(VERSION)
    .option('--project <path>', 'Project root override')

program
    .command('init')
    .description('Initialize memory, section the project, and build indexes.')
    .action(async () => {
        await initCommand(program.opts())
    })

program
    .command('status')
    .description('Print Konteks project memory status for humans.')
    .action(async () => {
        await getStatusCommand(program.opts())
    })

program
    .command('doctor')
    .description('Diagnose runtime, project root, and memory directory setup.')
    .action(async () => {
        await getHealthCommand(program.opts())
    })

program
    .command('repair')
    .description('Repair Konteks memory by rebuilding artifacts from scratch.')
    .action(async () => {
        await repairCommand(program.opts())
    })

const mcp = program
    .command('mcp')
    .description('Start the MCP server or run MCP debug commands.')
    .action(async () => {
        await startMcpServer({ project: program.opts().project })
    })

mcp.command('tools')
    .description('List MCP tools exposed by Konteks.')
    .action(async () => {
        await getToolsCommand()
    })

mcp.command('tool')
    .description('Show one MCP tool exposed by Konteks.')
    .argument('<name>', 'MCP tool name, such as konteks_warm_up')
    .action(async (name: string) => {
        await getToolDetailCommand(name)
    })

mcp.command('prompts')
    .description('List MCP prompts exposed by Konteks.')
    .action(async () => {
        await getPromptsCommand()
    })

mcp.command('prompt')
    .description('Render one MCP prompt for debugging.')
    .argument('<name>', 'MCP prompt name, such as konteks-warm-up')
    .argument(
        '[input...]',
        'Optional JSON prompt arguments or free-form warm-up topic',
    )
    .action(async (name: string, input?: string[]) => {
        await getPromptDetailCommand(name, input?.join(' '))
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
            options?: { apply?: boolean; json?: boolean },
        ) => {
            await callMcpToolCommand(program.opts(), name, jsonInput, options)
        },
    )

program
    .command('install-skills')
    .description('Install Konteks skills for agents without MCP prompts.')
    .option('--global', 'Install into ~/.agents/skills')
    .action(async (options: { global?: boolean }) => {
        await installSkillsCommand({
            ...program.opts(),
            ...options,
        })
    })

await program.parseAsync(process.argv)
