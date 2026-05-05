import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathExists } from '../project/context.js'
import type { ScannedFile } from './file-scan.js'

export type ProjectMetadata = {
    name?: string
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

    return {
        dependencies,
        devDependencies,
        name:
            typeof packageJson?.name === 'string'
                ? packageJson.name
                : undefined,
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
