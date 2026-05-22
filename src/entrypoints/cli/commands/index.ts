import BackupCommand from './backup-command'
import ConfigCommand from './config-command'
import InitCommand from './init-command'
import InstallSkillsCommand from './install-skills-command'
import McpCommand from './mcp-command'
import ExportCommand from './memory/export-command'
import ImportCommand from './memory/import-command'
import RebuildCommand from './rebuild-command'
import RestoreCommand from './restore-command'
import StatusCommand from './status-command'

export const COMMANDS = [
    new InitCommand(),
    new ConfigCommand(),
    new StatusCommand(),
    new RebuildCommand(),
    new BackupCommand(),
    new RestoreCommand(),
    new InstallSkillsCommand(),
    new McpCommand(),
] as const

export const MEMORY_COMMANDS = [
    new ExportCommand(),
    new ImportCommand(),
] as const
