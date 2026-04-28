import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathExists } from '../project/context.js'
import type { ScannedFile } from './file-scan.js'

export type ProjectMetadata = {
    name?: string
    packageManager?: string
    scripts: string[]
    dependencies: string[]
    devDependencies: string[]
    readmeFiles: string[]
    technologies: string[]
}

type PackageJson = {
    name?: unknown
    packageManager?: unknown
    scripts?: unknown
    dependencies?: unknown
    devDependencies?: unknown
}

export async function extractProjectMetadata(
    projectRoot: string,
    files: ScannedFile[],
): Promise<ProjectMetadata> {
    const packageJson = await readPackageJson(projectRoot)
    const dependencies = keysOfRecord(packageJson?.dependencies)
    const devDependencies = keysOfRecord(packageJson?.devDependencies)
    const scripts = keysOfRecord(packageJson?.scripts)
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
        packageManager:
            typeof packageJson?.packageManager === 'string'
                ? packageJson.packageManager
                : undefined,
        readmeFiles,
        scripts,
        technologies: inferTechnologies(files, dependencies, devDependencies),
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
