import { dirname, join, resolve } from 'node:path'
import type { ProjectRepositoryContract } from '@/app/contracts/repositories/project-repository'
import type {
    KonteksConfig,
    Project,
    ProjectContext,
} from '@/app/models/project'
import { access, readFile } from '@/app/support/file-manager'

export class FileSystemProjectRepository implements ProjectRepositoryContract {
    async getProject(rootPath: string): Promise<Project> {
        const projectRoot = rootPath
            ? resolve(rootPath)
            : await this.findProjectRoot(process.cwd())
        const memoryDir = join(projectRoot, '.konteks')
        const configPath = join(memoryDir, 'config.json')

        const configInfo = await this.readConfig(configPath, projectRoot)

        return {
            config: configInfo.config,
            configExists: configInfo.exists,
            configPath,
            memoryDir,
            projectRoot,
        }
    }

    async saveProjectContext(_context: ProjectContext): Promise<void> {
        // Implement if needed, currently not used in original code except for creation
    }

    private async findProjectRoot(start: string): Promise<string> {
        let current = resolve(start)

        while (true) {
            if (
                (await this.pathExists(join(current, '.git'))) ||
                (await this.pathExists(join(current, 'package.json')))
            ) {
                return current
            }

            const parent = dirname(current)
            if (parent === current) {
                return resolve(start)
            }
            current = parent
        }
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            await access(path)
            return true
        } catch {
            return false
        }
    }

    private async readConfig(
        configPath: string,
        projectRoot: string,
    ): Promise<{ config: KonteksConfig; exists: boolean }> {
        if (!(await this.pathExists(configPath))) {
            return {
                config: this.createDefaultConfig(projectRoot),
                exists: false,
            }
        }

        const raw = await readFile(configPath, 'utf8')
        const parsed = JSON.parse(raw) as Partial<KonteksConfig>

        return {
            config: this.mergeConfig(
                this.createDefaultConfig(projectRoot),
                parsed,
            ),
            exists: true,
        }
    }

    private createDefaultConfig(projectRoot: string): KonteksConfig {
        return {
            projectRoot,
            recall: {
                maxTokens: 2000,
            },
            storage: {
                inlinePayloadMaxBytes: 2048,
                memoryDir: '.konteks',
            },
        }
    }

    private mergeConfig(
        defaults: KonteksConfig,
        config: Partial<KonteksConfig>,
    ): KonteksConfig {
        return {
            projectRoot: config.projectRoot ?? defaults.projectRoot,
            recall: {
                maxTokens:
                    config.recall?.maxTokens ?? defaults.recall.maxTokens,
            },
            storage: {
                inlinePayloadMaxBytes:
                    config.storage?.inlinePayloadMaxBytes ??
                    defaults.storage.inlinePayloadMaxBytes,
                memoryDir:
                    config.storage?.memoryDir ?? defaults.storage.memoryDir,
            },
        }
    }
}
