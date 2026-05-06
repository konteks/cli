#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import { statusCommand } from './cli/commands/status.js'

const VERSION = readPackageVersion()

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
    .argument('[json]', 'Optional JSON prompt arguments')
    .action(async (name: string, jsonInput?: string) => {
        await mcpPromptCommand(name, jsonInput)
    })

mcp.command('call')
    .description('Call one MCP tool for debugging.')
    .argument('<tool>', 'MCP tool name, such as konteks_status')
    .argument('[json]', 'Optional JSON tool input')
    .action(async (name: string, jsonInput?: string) => {
        await mcpCallCommand(program.opts(), name, jsonInput)
    })

await program.parseAsync(process.argv)

function readPackageVersion(): string {
    try {
        const cliDir = dirname(fileURLToPath(import.meta.url))
        const candidates = [
            join(cliDir, '..', 'package.json'),
            join(cliDir, '..', '..', 'package.json'),
        ]

        for (const path of candidates) {
            const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
                version?: unknown
            }
            if (typeof parsed.version === 'string') {
                return parsed.version
            }
        }
    } catch {
        // Keep --version usable even if package metadata is unavailable.
    }

    return '0.0.0'
}
