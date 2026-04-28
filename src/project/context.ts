import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

type ProjectContext = {
    projectRoot: string
    memoryDir: string
    configPath: string
}

type KonteksConfig = {
    projectRoot: string
    storage: {
        inlinePayloadMaxBytes: number
        memoryDir: string
    }
    recall: {
        maxTokens: number
    }
}

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
