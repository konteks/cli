#!/usr/bin/env node
import { Command } from 'commander'
import { doctorCommand } from './cli/commands/doctor.js'
import { initCommand } from './cli/commands/init.js'
import {
    mcpCallCommand,
    mcpCommand,
    mcpPromptCommand,
    mcpPromptsCommand,
    mcpToolsCommand,
} from './cli/commands/mcp.js'
import { repairCommand } from './cli/commands/mine.js'
import { skillsInstallCommand } from './cli/commands/skills.js'
import { statusCommand } from './cli/commands/status.js'
import { VERSION } from './cli/version.js'

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
        await statusCommand(program.opts())
    })

program
    .command('doctor')
    .description('Diagnose runtime, project root, and memory directory setup.')
    .action(async () => {
        await doctorCommand(program.opts())
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
        await mcpCommand(program.opts())
    })

mcp.command('tools')
    .description('List MCP tools exposed by Konteks.')
    .action(async () => {
        await mcpToolsCommand(program.opts())
    })

mcp.command('prompts')
    .description('List MCP prompts exposed by Konteks.')
    .action(async () => {
        await mcpPromptsCommand()
    })

mcp.command('prompt')
    .description('Render one MCP prompt for debugging.')
    .argument('<name>', 'MCP prompt name, such as konteks-warm-up')
    .argument(
        '[input...]',
        'Optional JSON prompt arguments or free-form warm-up topic',
    )
    .action(async (name: string, input?: string[]) => {
        await mcpPromptCommand(name, input?.join(' '))
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
            await mcpCallCommand(program.opts(), name, jsonInput, options)
        },
    )

program
    .command('install-skills')
    .description('Install Konteks skills for agents without MCP prompts.')
    .option('--global', 'Install into ~/.agents/skills')
    .action(async (options: { global?: boolean }) => {
        await skillsInstallCommand({
            ...program.opts(),
            ...options,
        })
    })

await program.parseAsync(process.argv)
