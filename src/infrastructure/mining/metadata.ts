import { join } from 'node:path'
import { readFile } from '@/services/file-manager'
import { pathExists } from '../file-system/context'
import type { ScannedFile } from './file-scan'

export type ProjectMetadata = {
    name?: string
    description?: string
    entryPoints: string[]
    packageManager?: string
    workspaceManager?: string
    workspaceGlobs: string[]
    packagePath: string
    scripts: string[]
    dependencies: string[]
    devDependencies: string[]
    peerDependencies: string[]
    optionalDependencies: string[]
    readmeFiles: string[]
    technologies: string[]
}

type PackageJson = {
    name?: unknown
    description?: unknown
    main?: unknown
    bin?: unknown
    exports?: unknown
    packageManager?: unknown
    scripts?: unknown
    dependencies?: unknown
    devDependencies?: unknown
    optionalDependencies?: unknown
    peerDependencies?: unknown
    workspaces?: unknown
}

export async function extractProjectMetadata(
    projectRoot: string,
    files: ScannedFile[],
): Promise<ProjectMetadata> {
    const packageJson = await readPackageJson(projectRoot)
    const dependencies = keysOfRecord(packageJson?.dependencies)
    const devDependencies = keysOfRecord(packageJson?.devDependencies)
    const peerDependencies = keysOfRecord(packageJson?.peerDependencies)
    const optionalDependencies = keysOfRecord(packageJson?.optionalDependencies)
    const scripts = keysOfRecord(packageJson?.scripts)
    const workspaceGlobs = parseWorkspaceGlobs(packageJson?.workspaces)
    const readmeFiles = files
        .map(file => file.path)
        .filter(path => /^readme(\..+)?$/i.test(path.split('/').at(-1) ?? ''))

    const name =
        typeof packageJson?.name === 'string' ? packageJson.name : undefined
    const description = await inferDescription(
        projectRoot,
        packageJson,
        readmeFiles,
    )
    const entryPoints = inferEntryPoints(packageJson)

    return {
        dependencies,
        description,
        devDependencies,
        entryPoints,
        name,
        optionalDependencies,
        packageManager:
            typeof packageJson?.packageManager === 'string'
                ? packageJson.packageManager
                : undefined,
        packagePath: 'package.json',
        peerDependencies,
        readmeFiles,
        scripts,
        technologies: inferTechnologies(files, dependencies, devDependencies),
        workspaceGlobs,
        workspaceManager: detectWorkspaceManager(files, workspaceGlobs),
    }
}

async function inferDescription(
    projectRoot: string,
    packageJson: PackageJson | undefined,
    readmeFiles: string[],
): Promise<string | undefined> {
    if (typeof packageJson?.description === 'string') {
        return packageJson.description
    }

    if (readmeFiles.length > 0) {
        try {
            const readmePath = join(projectRoot, readmeFiles[0])
            const content = await readFile(readmePath, 'utf8')
            const lines = content.split('\n')
            // Find first paragraph after the title
            let foundTitle = false
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) {
                    continue
                }
                if (trimmed.startsWith('#')) {
                    foundTitle = true
                    continue
                }
                if (foundTitle && !trimmed.startsWith('![')) {
                    // Extract first sentence or two
                    return `${trimmed.split(/[.!?](?:\s|$)/u)[0]}.`
                }
            }
        } catch {
            return undefined
        }
    }

    return undefined
}

function inferEntryPoints(packageJson: PackageJson | undefined): string[] {
    const entries = new Set<string>()

    if (typeof packageJson?.main === 'string') {
        entries.add(packageJson.main)
    }

    if (packageJson?.bin) {
        if (typeof packageJson.bin === 'string') {
            entries.add(packageJson.bin)
        } else if (typeof packageJson.bin === 'object') {
            for (const value of Object.values(packageJson.bin)) {
                if (typeof value === 'string') {
                    entries.add(value)
                }
            }
        }
    }

    if (packageJson?.exports) {
        const visit = (value: unknown): void => {
            if (typeof value === 'string') {
                entries.add(value)
            } else if (value && typeof value === 'object') {
                for (const child of Object.values(value)) {
                    visit(child)
                }
            }
        }
        visit(packageJson.exports)
    }

    return [...entries]
        .map(p => p.replace(/^\.\//, ''))
        .filter(Boolean)
        .sort()
}

async function readPackageJson(
    projectRoot: string,
): Promise<PackageJson | undefined> {
    const packagePath = join(projectRoot, 'package.json')
    if (!(await pathExists(packagePath))) {
        return undefined
    }

    return JSON.parse(await readFile(packagePath, 'utf8')) as PackageJson
}

function keysOfRecord(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return []
    }

    return Object.keys(value).sort((left, right) => left.localeCompare(right))
}

function parseWorkspaceGlobs(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter(item => typeof item === 'string').sort()
    }
    if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Array.isArray((value as { packages?: unknown }).packages)
    ) {
        return (value as { packages: unknown[] }).packages
            .filter(item => typeof item === 'string')
            .sort() as string[]
    }
    return []
}

function detectWorkspaceManager(
    files: ScannedFile[],
    workspaceGlobs: string[],
): string | undefined {
    const paths = new Set(files.map(file => file.path))
    if (paths.has('pnpm-workspace.yaml')) {
        return 'pnpm'
    }
    if (paths.has('turbo.json')) {
        return 'turbo'
    }
    if (paths.has('nx.json')) {
        return 'nx'
    }
    if (workspaceGlobs.length > 0) {
        return 'package.json'
    }
    return undefined
}

function inferTechnologies(
    files: ScannedFile[],
    dependencies: string[],
    devDependencies: string[],
): string[] {
    const paths = new Set(files.map(file => file.path))
    const packages = new Set([...dependencies, ...devDependencies])
    const technologies = new Set<string>()

    if (paths.has('package.json')) {
        technologies.add('javascript')
    }
    if ([...paths].some(path => path.endsWith('.ts'))) {
        technologies.add('typescript')
    }
    if (paths.has('bun.lock') || packages.has('@types/bun')) {
        technologies.add('bun')
    }
    if (packages.has('@modelcontextprotocol/sdk')) {
        technologies.add('mcp')
    }
    if (packages.has('commander')) {
        technologies.add('cli')
    }

    return [...technologies].sort((left, right) => left.localeCompare(right))
}
