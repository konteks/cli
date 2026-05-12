import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
    KonteksConfig,
    LoadedProjectContext,
    ProjectContext,
} from '@/app/models/project'

export type { LoadedProjectContext }

export function createDefaultConfig(projectRoot: string): KonteksConfig {
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

export async function resolveProjectContext(
    projectOverride?: string,
): Promise<ProjectContext> {
    const projectRoot = projectOverride
        ? resolve(projectOverride)
        : await findProjectRoot(process.cwd())
    const memoryDir = join(projectRoot, '.konteks')

    return {
        configPath: join(memoryDir, 'config.json'),
        memoryDir,
        projectRoot,
    }
}

export async function loadProjectContext(
    projectOverride?: string,
): Promise<LoadedProjectContext> {
    const context = await resolveProjectContext(projectOverride)
    const config = await readConfig(context.configPath, context.projectRoot)

    return {
        ...context,
        config: config.config,
        configExists: config.exists,
    }
}

async function findProjectRoot(start: string): Promise<string> {
    let current = resolve(start)

    while (true) {
        if (
            (await pathExists(join(current, '.git'))) ||
            (await pathExists(join(current, 'package.json')))
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

export async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path)
        return true
    } catch {
        return false
    }
}

async function readConfig(
    configPath: string,
    projectRoot: string,
): Promise<{ config: KonteksConfig; exists: boolean }> {
    if (!(await pathExists(configPath))) {
        return {
            config: createDefaultConfig(projectRoot),
            exists: false,
        }
    }

    const raw = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<KonteksConfig>

    return {
        config: mergeConfig(createDefaultConfig(projectRoot), parsed),
        exists: true,
    }
}

function mergeConfig(
    defaults: KonteksConfig,
    config: Partial<KonteksConfig>,
): KonteksConfig {
    return {
        projectRoot: config.projectRoot ?? defaults.projectRoot,
        recall: {
            maxTokens: config.recall?.maxTokens ?? defaults.recall.maxTokens,
        },
        storage: {
            inlinePayloadMaxBytes:
                config.storage?.inlinePayloadMaxBytes ??
                defaults.storage.inlinePayloadMaxBytes,
            memoryDir: config.storage?.memoryDir ?? defaults.storage.memoryDir,
        },
    }
}
