import type { BaseCommandRegistrar } from '@/commands/_base-command'
import BackupCommand from '@/commands/backup-command'
import ConfigCommand from '@/commands/config-command'
import InitCommand from '@/commands/init-command'
import InstallSkillsCommand from '@/commands/install-skills-command'
import McpCommand from '@/commands/mcp-command'
import ExportCommand from '@/commands/memory/export-command'
import ImportCommand from '@/commands/memory/import-command'
import RepairCommand from '@/commands/repair-command'
import RestoreCommand from '@/commands/restore-command'
import StatusCommand from '@/commands/status-command'

export const commands: BaseCommandRegistrar[] = [
    new InitCommand(),
    new ConfigCommand(),
    new StatusCommand(),
    new RepairCommand(),
    new BackupCommand(),
    new RestoreCommand(),
    new InstallSkillsCommand(),
    new McpCommand(),
]

export const memoryCommands: BaseCommandRegistrar[] = [
    new ExportCommand(),
    new ImportCommand(),
]
