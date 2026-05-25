import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathExists } from '@/modules/project/context'
import type { ScannedFile } from './file-scan'

export type ProjectMetadata = {
    name?: string
    description?: string
    entryPoints: string[]
    packageManager?: string
    workspaceManager?: string
    workspaceGlobs: string[]
    packagePath?: string
    packageManifests: PackageManifestMetadata[]
    scripts: string[]
    dependencies: string[]
    devDependencies: string[]
    peerDependencies: string[]
    optionalDependencies: string[]
    readmeFiles: string[]
    technologies: string[]
}

export type PackageManifestMetadata = {
    path: string
    manager: string
    name?: string
    description?: string
    dependencies: string[]
    devDependencies: string[]
    entryPoints: string[]
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

export default async function extractProjectMetadata(
    projectRoot: string,
    files: ScannedFile[],
): Promise<ProjectMetadata> {
    const paths = new Set(files.map(file => file.path))
    const packageJson = await readJsonFile<PackageJson>(
        projectRoot,
        'package.json',
    )
    const dependencies = keysOfRecord(packageJson?.dependencies)
    const devDependencies = keysOfRecord(packageJson?.devDependencies)
    const peerDependencies = keysOfRecord(packageJson?.peerDependencies)
    const optionalDependencies = keysOfRecord(packageJson?.optionalDependencies)
    const scripts = keysOfRecord(packageJson?.scripts)
    const workspaceGlobs = parseWorkspaceGlobs(packageJson?.workspaces)
    const nodeManifest = packageJson
        ? nodePackageManifest(packageJson)
        : undefined
    const packageManifests = [
        nodeManifest,
        await composerManifest(projectRoot, paths),
        await pubspecManifest(projectRoot, paths),
        await pyprojectManifest(projectRoot, paths),
        await goModManifest(projectRoot, paths),
        await cargoManifest(projectRoot, paths),
        await javaManifest(projectRoot, paths),
        await rubyManifest(projectRoot, paths),
        await swiftManifest(projectRoot, paths),
        await dotnetManifest(projectRoot, files),
    ].filter(
        (manifest): manifest is PackageManifestMetadata =>
            manifest !== undefined,
    )
    const primaryManifest = packageManifests[0]
    const readmeFiles = files
        .map(file => file.path)
        .filter(path => /^readme(\..+)?$/i.test(path.split('/').at(-1) ?? ''))

    const nodeName = stringValue(packageJson?.name)
    const name =
        nodeName ??
        packageManifests.find(manifest => manifest.name !== undefined)?.name
    const description = await inferDescription(
        projectRoot,
        packageJson,
        readmeFiles,
        packageManifests,
    )
    const entryPoints = uniqueSorted([
        ...inferNodeEntryPoints(packageJson),
        ...packageManifests.flatMap(manifest => manifest.entryPoints),
    ])
    const allDependencies = uniqueSorted([
        ...dependencies,
        ...packageManifests.flatMap(manifest => manifest.dependencies),
    ])
    const allDevDependencies = uniqueSorted([
        ...devDependencies,
        ...packageManifests.flatMap(manifest => manifest.devDependencies),
    ])

    return {
        dependencies: allDependencies,
        description,
        devDependencies: allDevDependencies,
        entryPoints,
        name,
        optionalDependencies,
        packageManager:
            typeof packageJson?.packageManager === 'string'
                ? packageJson.packageManager
                : primaryManifest?.manager,
        packageManifests,
        packagePath: primaryManifest?.path,
        peerDependencies,
        readmeFiles,
        scripts,
        technologies: inferTechnologies(files, packageManifests, [
            ...allDependencies,
            ...allDevDependencies,
        ]),
        workspaceGlobs,
        workspaceManager: detectWorkspaceManager(files, workspaceGlobs),
    }
}

async function inferDescription(
    projectRoot: string,
    packageJson: PackageJson | undefined,
    readmeFiles: string[],
    packageManifests: PackageManifestMetadata[],
): Promise<string | undefined> {
    const nodeDescription = stringValue(packageJson?.description)
    if (nodeDescription) {
        return nodeDescription
    }
    const manifestDescription = packageManifests.find(
        manifest => manifest.description,
    )?.description
    if (manifestDescription) {
        return manifestDescription
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

function inferNodeEntryPoints(packageJson: PackageJson | undefined): string[] {
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

async function readJsonFile<T>(
    projectRoot: string,
    relativePath: string,
): Promise<T | undefined> {
    const packagePath = join(projectRoot, relativePath)
    if (!(await pathExists(packagePath))) {
        return undefined
    }

    return JSON.parse(await readFile(packagePath, 'utf8')) as T
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
    manifests: PackageManifestMetadata[],
    dependencyNames: string[],
): string[] {
    const paths = new Set(files.map(file => file.path))
    const packages = new Set(dependencyNames)
    const technologies = new Set<string>()

    for (const manifest of manifests) {
        for (const technology of manifest.technologies) {
            technologies.add(technology)
        }
    }
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
    if ([...paths].some(path => path.endsWith('.php'))) {
        technologies.add('php')
    }
    if ([...paths].some(path => path.endsWith('.dart'))) {
        technologies.add('dart')
    }
    if ([...paths].some(path => path.endsWith('.py'))) {
        technologies.add('python')
    }
    if ([...paths].some(path => path.endsWith('.go'))) {
        technologies.add('go')
    }
    if ([...paths].some(path => path.endsWith('.rs'))) {
        technologies.add('rust')
    }
    if ([...paths].some(path => path.endsWith('.java'))) {
        technologies.add('java')
    }
    if ([...paths].some(path => /\.(kt|kts)$/u.test(path))) {
        technologies.add('kotlin')
    }
    if ([...paths].some(path => path.endsWith('.rb'))) {
        technologies.add('ruby')
    }
    if ([...paths].some(path => path.endsWith('.swift'))) {
        technologies.add('swift')
    }
    if ([...paths].some(path => path.endsWith('.cs'))) {
        technologies.add('csharp')
    }

    return [...technologies].sort((left, right) => left.localeCompare(right))
}

function nodePackageManifest(
    packageJson: PackageJson,
): PackageManifestMetadata {
    return {
        dependencies: keysOfRecord(packageJson.dependencies),
        description:
            typeof packageJson.description === 'string'
                ? packageJson.description
                : undefined,
        devDependencies: keysOfRecord(packageJson.devDependencies),
        entryPoints: inferNodeEntryPoints(packageJson),
        manager:
            typeof packageJson.packageManager === 'string'
                ? packageJson.packageManager
                : 'npm',
        name:
            typeof packageJson.name === 'string' ? packageJson.name : undefined,
        path: 'package.json',
        technologies: ['javascript'],
    }
}

async function composerManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (!paths.has('composer.json')) {
        return undefined
    }
    const composer = await readJsonFile<Record<string, unknown>>(
        projectRoot,
        'composer.json',
    )
    const dependencies = keysOfRecord(composer?.require).filter(
        name => name !== 'php',
    )
    const devDependencies = keysOfRecord(composer?.['require-dev'])
    const allPackages = new Set([...dependencies, ...devDependencies])
    const entryPoints = existingPaths(paths, [
        'public/index.php',
        'index.php',
        'artisan',
        'bin/console',
    ])
    const technologies = ['php', 'composer']
    if (allPackages.has('laravel/framework') || paths.has('artisan')) {
        technologies.push('laravel')
    }
    if (
        allPackages.has('symfony/framework-bundle') ||
        paths.has('bin/console')
    ) {
        technologies.push('symfony')
    }
    if (paths.has('wp-config.php') || paths.has('wp-includes/version.php')) {
        technologies.push('wordpress')
    }

    return {
        dependencies,
        description: stringValue(composer?.description),
        devDependencies,
        entryPoints,
        manager: 'composer',
        name: stringValue(composer?.name),
        path: 'composer.json',
        technologies,
    }
}

async function pubspecManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (!paths.has('pubspec.yaml')) {
        return undefined
    }
    const parsed = parseSimpleYaml(
        await readFile(join(projectRoot, 'pubspec.yaml'), 'utf8'),
    )
    const dependencies = Object.keys(parsed.dependencies ?? {}).sort()
    const devDependencies = Object.keys(parsed.dev_dependencies ?? {}).sort()
    const technologies = ['dart', 'pub']
    if (dependencies.includes('flutter') || parsed.flutter) {
        technologies.push('flutter')
    }

    return {
        dependencies,
        description: stringValue(parsed.description),
        devDependencies,
        entryPoints: existingPaths(paths, ['lib/main.dart']),
        manager: 'pub',
        name: stringValue(parsed.name),
        path: 'pubspec.yaml',
        technologies,
    }
}

async function pyprojectManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (
        !paths.has('pyproject.toml') &&
        !paths.has('requirements.txt') &&
        !paths.has('setup.py')
    ) {
        return undefined
    }
    const pyproject = paths.has('pyproject.toml')
        ? parseSimpleToml(
              await readFile(join(projectRoot, 'pyproject.toml'), 'utf8'),
          )
        : {}
    const dependencies = [
        ...stringArray(pyproject['project.dependencies']),
        ...(paths.has('requirements.txt')
            ? parseRequirementNames(
                  await readFile(join(projectRoot, 'requirements.txt'), 'utf8'),
              )
            : []),
    ]
    const devDependencies = stringArray(
        pyproject['project.optional-dependencies.dev'],
    )
    const allPackages = new Set([...dependencies, ...devDependencies])
    const technologies = ['python']
    for (const [dependency, technology] of [
        ['django', 'django'],
        ['flask', 'flask'],
        ['fastapi', 'fastapi'],
        ['pytest', 'pytest'],
    ] as const) {
        if (allPackages.has(dependency)) {
            technologies.push(technology)
        }
    }

    return {
        dependencies: uniqueSorted(dependencies),
        description: stringValue(pyproject['project.description']),
        devDependencies: uniqueSorted(devDependencies),
        entryPoints: existingPaths(paths, ['main.py', 'app.py', 'manage.py']),
        manager: paths.has('pyproject.toml') ? 'pyproject' : 'pip',
        name: stringValue(pyproject['project.name']),
        path: paths.has('pyproject.toml')
            ? 'pyproject.toml'
            : 'requirements.txt',
        technologies,
    }
}

async function goModManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (!paths.has('go.mod')) {
        return undefined
    }
    const content = await readFile(join(projectRoot, 'go.mod'), 'utf8')
    return {
        dependencies: parseGoRequires(content),
        devDependencies: [],
        entryPoints: existingPaths(paths, [
            'main.go',
            ...[...paths].filter(path => /^cmd\/[^/]+\/main\.go$/u.test(path)),
        ]),
        manager: 'go modules',
        name: content.match(/^module\s+(\S+)/mu)?.[1],
        path: 'go.mod',
        technologies: ['go'],
    }
}

async function cargoManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (!paths.has('Cargo.toml')) {
        return undefined
    }
    const parsed = parseSimpleToml(
        await readFile(join(projectRoot, 'Cargo.toml'), 'utf8'),
    )
    return {
        dependencies: keysWithPrefix(parsed, 'dependencies.'),
        devDependencies: keysWithPrefix(parsed, 'dev-dependencies.'),
        entryPoints: existingPaths(paths, ['src/main.rs', 'src/lib.rs']),
        manager: 'cargo',
        name: stringValue(parsed['package.name']),
        path: 'Cargo.toml',
        technologies: ['cargo', 'rust'],
    }
}

async function javaManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    const path = [
        'pom.xml',
        'build.gradle',
        'build.gradle.kts',
        'settings.gradle',
    ].find(candidate => paths.has(candidate))
    if (!path) {
        return undefined
    }
    const content = await readFile(join(projectRoot, path), 'utf8')
    const dependencies =
        path === 'pom.xml'
            ? parsePomDependencies(content)
            : parseGradleDependencies(content)
    const technologies = [path === 'pom.xml' ? 'maven' : 'gradle']
    if ([...paths].some(candidate => candidate.endsWith('.java'))) {
        technologies.push('java')
    }
    if ([...paths].some(candidate => /\.(kt|kts)$/u.test(candidate))) {
        technologies.push('kotlin')
    }

    return {
        dependencies,
        devDependencies: [],
        entryPoints: [],
        manager: path === 'pom.xml' ? 'maven' : 'gradle',
        name:
            path === 'pom.xml'
                ? content.match(/<artifactId>([^<]+)<\/artifactId>/u)?.[1]
                : undefined,
        path,
        technologies,
    }
}

async function rubyManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    const gemspec = [...paths].find(path => path.endsWith('.gemspec'))
    const path = paths.has('Gemfile') ? 'Gemfile' : gemspec
    if (!path) {
        return undefined
    }
    const content = await readFile(join(projectRoot, path), 'utf8')
    const dependencies = parseRubyDependencies(content)
    const technologies = ['ruby', 'bundler']
    if (dependencies.includes('rails') || paths.has('config/application.rb')) {
        technologies.push('rails')
    }
    return {
        dependencies,
        devDependencies: [],
        entryPoints: existingPaths(paths, ['config.ru']),
        manager: 'bundler',
        path,
        technologies,
    }
}

async function swiftManifest(
    projectRoot: string,
    paths: Set<string>,
): Promise<PackageManifestMetadata | undefined> {
    if (!paths.has('Package.swift')) {
        return undefined
    }
    const content = await readFile(join(projectRoot, 'Package.swift'), 'utf8')
    return {
        dependencies: [
            ...content.matchAll(/\.package\([^)]*url:\s*"([^"]+)"/gu),
        ]
            .map(match => match[1] ?? '')
            .filter(Boolean)
            .sort(),
        devDependencies: [],
        entryPoints: [],
        manager: 'swift package manager',
        name: content.match(/name:\s*"([^"]+)"/u)?.[1],
        path: 'Package.swift',
        technologies: ['swift'],
    }
}

async function dotnetManifest(
    projectRoot: string,
    files: ScannedFile[],
): Promise<PackageManifestMetadata | undefined> {
    const path = files
        .map(file => file.path)
        .find(
            candidate =>
                candidate.endsWith('.csproj') || candidate.endsWith('.sln'),
        )
    if (!path) {
        return undefined
    }
    const content = await readFile(join(projectRoot, path), 'utf8')
    return {
        dependencies: [
            ...content.matchAll(/<PackageReference\s+Include="([^"]+)"/gu),
        ]
            .map(match => match[1] ?? '')
            .filter(Boolean)
            .sort(),
        devDependencies: [],
        entryPoints: [],
        manager: 'dotnet',
        name: path
            .split('/')
            .at(-1)
            ?.replace(/\.(csproj|sln)$/u, ''),
        path,
        technologies: ['csharp', 'dotnet'],
    }
}

function existingPaths(paths: Set<string>, candidates: string[]): string[] {
    return candidates.filter(path => paths.has(path)).sort()
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) =>
        left.localeCompare(right),
    )
}

function parseSimpleYaml(content: string): Record<string, unknown> {
    const root: Record<string, unknown> = {}
    let currentMap: Record<string, unknown> | undefined
    for (const line of content.split(/\r?\n/u)) {
        const match = line.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$/u)
        if (!match) {
            continue
        }
        const [, indent = '', key = '', rawValue = ''] = match
        if (indent.length === 0) {
            if (rawValue.trim()) {
                root[key] = rawValue.trim().replace(/^['"]|['"]$/gu, '')
                currentMap = undefined
            } else {
                currentMap = {}
                root[key] = currentMap
            }
        } else if (indent.length === 2 && currentMap) {
            currentMap[key] =
                rawValue.trim().replace(/^['"]|['"]$/gu, '') || true
        }
    }
    return root
}

function parseSimpleToml(content: string): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    let section = ''
    for (const line of content.split(/\r?\n/u)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
            continue
        }
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/u)
        if (sectionMatch) {
            section = sectionMatch[1] ?? ''
            continue
        }
        const pair = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/u)
        if (!pair) {
            continue
        }
        const key = section ? `${section}.${pair[1]}` : (pair[1] ?? '')
        values[key] = parseTomlValue(pair[2] ?? '')
    }
    return values
}

function parseTomlValue(value: string): unknown {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return [...trimmed.matchAll(/"([^"]+)"/gu)].map(match => match[1])
    }
    return trimmed.replace(/^['"]|['"]$/gu, '')
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : []
}

function parseRequirementNames(content: string): string[] {
    return uniqueSorted(
        content
            .split(/\r?\n/u)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => line.split(/[<>=~!;[]/u)[0]?.trim() ?? '')
            .filter(Boolean),
    )
}

function parseGoRequires(content: string): string[] {
    const dependencies = new Set<string>()
    for (const match of content.matchAll(/^\s*require\s+(\S+)/gmu)) {
        if (match[1] !== '(') {
            dependencies.add(match[1] ?? '')
        }
    }
    const block = content.match(/require\s*\(([\s\S]*?)\)/u)?.[1]
    if (block) {
        for (const line of block.split(/\r?\n/u)) {
            const name = line.trim().split(/\s+/u)[0]
            if (name) {
                dependencies.add(name)
            }
        }
    }
    return uniqueSorted([...dependencies])
}

function keysWithPrefix(
    values: Record<string, unknown>,
    prefix: string,
): string[] {
    return uniqueSorted(
        Object.keys(values)
            .filter(key => key.startsWith(prefix))
            .map(key => key.slice(prefix.length)),
    )
}

function parsePomDependencies(content: string): string[] {
    return uniqueSorted(
        [
            ...content.matchAll(
                /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<\/dependency>/gu,
            ),
        ]
            .map(match => match[1] ?? '')
            .filter(Boolean),
    )
}

function parseGradleDependencies(content: string): string[] {
    return uniqueSorted(
        [
            ...content.matchAll(
                /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\(?["']([^:"']+):([^:"']+)/gu,
            ),
        ]
            .map(match => `${match[1]}:${match[2]}`)
            .filter(Boolean),
    )
}

function parseRubyDependencies(content: string): string[] {
    return uniqueSorted(
        [...content.matchAll(/\bgem\s+['"]([^'"]+)['"]/gu)]
            .map(match => match[1] ?? '')
            .filter(Boolean),
    )
}
