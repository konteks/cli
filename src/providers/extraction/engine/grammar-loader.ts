import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as os from 'node:os'
import { basename, join } from 'node:path'
import registryJson from '@/assets/grammars/registry.json' with { type: 'json' }
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type { Project } from '@/models/project'
import { pathExists } from '@/providers/project/context'

type TreeSitterBootstrapEngine = {
    init(): Promise<void>
    loadLanguage(lang: string, wasmPath: string): Promise<void>
}

export type GrammarDefinition = {
    aliases: string[]
    displayName: string
    extensions: string[]
    fallbackVersion: string
    gitRepoUrl: string
    id: string
    latestUrl?: string
    package: string
    wasmFile: string
}

type GrammarCacheEntry = {
    checkedAt: string
    id: string
    package: string
    sha256: string
    version: string
    wasmFile: string
}

type GrammarCacheManifest = {
    grammars: Record<string, GrammarCacheEntry>
    version: 1
}

type BundledGrammarDefinition = {
    displayName: string
    extensions: string[]
    id: string
    wasmPath: string
}

type GrammarMatch = GrammarDefinition | BundledGrammarDefinition

const require = createRequire(import.meta.url)
const registry = loadGrammarRegistry(registryJson)

const bundledGrammars: BundledGrammarDefinition[] = [
    {
        displayName: 'JSON',
        extensions: ['.json', '.jsonc'],
        id: 'json',
        wasmPath: require.resolve('tree-sitter-json/tree-sitter-json.wasm'),
    },
    {
        displayName: 'YAML',
        extensions: ['.yaml', '.yml'],
        id: 'yaml',
        wasmPath: require.resolve(
            '@tree-sitter-grammars/tree-sitter-yaml/tree-sitter-yaml.wasm',
        ),
    },
    {
        displayName: 'TOML',
        extensions: ['.toml'],
        id: 'toml',
        wasmPath: require.resolve(
            '@tree-sitter-grammars/tree-sitter-toml/tree-sitter-toml.wasm',
        ),
    },
]

export function listGrammarDefinitions(): GrammarDefinition[] {
    return [...registry]
}

function getGrammarDefinition(id: string): GrammarDefinition | undefined {
    return registry.find(grammar => grammar.id === id)
}

export function getGrammarForPath(path: string): GrammarMatch | undefined {
    return getRegistryGrammarForPath(path) ?? getBundledGrammarForPath(path)
}

export function isBundledGrammar(id: string): boolean {
    return bundledGrammars.some(grammar => grammar.id === id)
}

function getRegistryGrammarForPath(
    path: string,
): GrammarDefinition | undefined {
    const lowerPath = path.toLowerCase()
    const fileName = lowerPath.split('/').at(-1) ?? lowerPath
    return registry.find(grammar =>
        grammarMatchesPath(grammar.extensions, lowerPath, fileName),
    )
}

function getBundledGrammarForPath(
    path: string,
): BundledGrammarDefinition | undefined {
    const lowerPath = path.toLowerCase()
    const fileName = lowerPath.split('/').at(-1) ?? lowerPath
    return bundledGrammars.find(grammar =>
        grammarMatchesPath(grammar.extensions, lowerPath, fileName),
    )
}

function grammarMatchesPath(
    extensions: string[],
    lowerPath: string,
    fileName: string,
): boolean {
    return extensions.some(extension =>
        extension.startsWith('.')
            ? lowerPath.endsWith(extension)
            : fileName === extension,
    )
}

export async function initTreeSitterWithSelectedGrammars(
    engine: TreeSitterBootstrapEngine,
    project: Project,
    options: {
        forceUpdate?: boolean
        paths?: string[]
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<{ loaded: string[]; warnings: string[] }> {
    const selected = normalizeSelectedGrammars(
        project.config.extraction.grammars.selected,
    )
    const bundled = bundledGrammarsForPaths(options.paths ?? [])
    const total = selected.length + bundled.length
    if (total === 0) {
        return { loaded: [], warnings: [] }
    }

    options.onProgress?.({
        message: `Preparing ${total} Tree-sitter grammars`,
        phase: 'preparation',
        status: 'start',
        total,
    })
    await engine.init()
    const cache = await readCacheManifest()
    const warnings: string[] = []
    const loaded: string[] = []

    for (const [index, definition] of bundled.entries()) {
        await engine.loadLanguage(definition.id, definition.wasmPath)
        loaded.push(definition.id)
        options.onProgress?.({
            current: index + 1,
            message: `Loaded ${definition.displayName} grammar`,
            phase: 'preparation',
            status: 'progress',
            total,
        })
    }

    for (const [index, id] of selected.entries()) {
        const definition = getGrammarDefinition(id)
        if (!definition) {
            throw new Error(`Unknown Tree-sitter grammar selected: ${id}`)
        }

        const loadedPath = await ensureCachedGrammar(definition, cache, {
            forceUpdate: options.forceUpdate,
            onProgress: options.onProgress,
            updateTtlHours: project.config.extraction.grammars.updateTtlHours,
        }).catch(async error => {
            const cached = cachedGrammarPath(definition)
            if (await pathExists(cached)) {
                const message = `Using cached ${definition.displayName} grammar; update failed: ${errorMessage(error)}`
                warnings.push(message)
                options.onProgress?.({
                    current: index + 1,
                    message,
                    phase: 'preparation',
                    status: 'progress',
                    total,
                })
                return cached
            }
            throw error
        })

        await engine.loadLanguage(definition.id, loadedPath)
        loaded.push(definition.id)
        options.onProgress?.({
            current: bundled.length + index + 1,
            message: `Loaded ${definition.displayName} grammar`,
            phase: 'preparation',
            status: 'progress',
            total,
        })
    }

    if (selected.length > 0) {
        await writeCacheManifest(cache)
    }
    options.onProgress?.({
        message: `Tree-sitter grammars ready: ${loaded.length} loaded`,
        phase: 'preparation',
        status: 'done',
        total,
    })

    return { loaded, warnings }
}

function bundledGrammarsForPaths(paths: string[]): BundledGrammarDefinition[] {
    return [
        ...new Set(
            paths
                .map(path => getBundledGrammarForPath(path))
                .filter(
                    (grammar): grammar is BundledGrammarDefinition =>
                        grammar !== undefined,
                ),
        ),
    ]
}

export async function updateSelectedGrammarCache(
    project: Project,
    options: {
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<{ updated: number; reused: number }> {
    const selected = normalizeSelectedGrammars(
        project.config.extraction.grammars.selected,
    )
    const cache = await readCacheManifest()
    let updated = 0
    let reused = 0

    for (const id of selected) {
        const definition = getGrammarDefinition(id)
        if (!definition) {
            throw new Error(`Unknown Tree-sitter grammar selected: ${id}`)
        }
        const before = cache.grammars[id]?.sha256
        await ensureCachedGrammar(definition, cache, {
            forceUpdate: true,
            onProgress: options.onProgress,
            updateTtlHours: 0,
        })
        if (before && before === cache.grammars[id]?.sha256) {
            reused += 1
        } else {
            updated += 1
        }
    }

    await writeCacheManifest(cache)
    return { reused, updated }
}

async function ensureCachedGrammar(
    definition: GrammarDefinition,
    cache: GrammarCacheManifest,
    options: {
        forceUpdate?: boolean
        onProgress?: ExtractionProgressReporter
        updateTtlHours: number
    },
): Promise<string> {
    const cachedPath = cachedGrammarPath(definition)
    const entry = cache.grammars[definition.id]
    const cacheExists = await pathExists(cachedPath)
    const shouldCheck =
        options.forceUpdate ||
        !entry ||
        !cacheExists ||
        isStale(entry.checkedAt, options.updateTtlHours)

    if (!shouldCheck && cacheExists) {
        return cachedPath
    }

    const latest = await resolveLatestGrammar(definition)
    const url = grammarDownloadUrl(definition, latest.version)
    options.onProgress?.({
        message: `Downloading ${definition.displayName} grammar ${latest.version}`,
        phase: 'preparation',
        status: 'progress',
    })
    const bytes = await downloadBytes(url)
    const sha256 = sha256Hex(bytes)
    await mkdir(grammarCacheDir(), { recursive: true })
    await writeFile(cachedPath, bytes)
    cache.grammars[definition.id] = {
        checkedAt: new Date().toISOString(),
        id: definition.id,
        package: definition.package,
        sha256,
        version: latest.version,
        wasmFile: basename(cachedPath),
    }
    return cachedPath
}

async function resolveLatestGrammar(
    definition: GrammarDefinition,
): Promise<{ url: string; version: string }> {
    if (!definition.latestUrl) {
        return {
            url: grammarDownloadUrl(definition, definition.fallbackVersion),
            version: definition.fallbackVersion,
        }
    }
    const response = await fetch(definition.latestUrl)
    if (!response.ok) {
        throw new Error(
            `Failed to check ${definition.package} version: HTTP ${response.status}`,
        )
    }
    const body = (await response.json()) as { version?: unknown }
    const version =
        typeof body.version === 'string'
            ? body.version
            : definition.fallbackVersion

    return {
        url: grammarDownloadUrl(definition, version),
        version,
    }
}

function grammarDownloadUrl(
    definition: GrammarDefinition,
    version: string,
): string {
    return `https://unpkg.com/${definition.package}@${version}/${definition.wasmFile}`
}

async function downloadBytes(url: string): Promise<Uint8Array> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
    }
    return new Uint8Array(await response.arrayBuffer())
}

async function readCacheManifest(): Promise<GrammarCacheManifest> {
    const path = grammarCacheManifestPath()
    if (!(await pathExists(path))) {
        return { grammars: {}, version: 1 }
    }

    try {
        const parsed = JSON.parse(
            await readFile(path, 'utf8'),
        ) as Partial<GrammarCacheManifest>
        return {
            grammars: parsed.grammars ?? {},
            version: 1,
        }
    } catch {
        return { grammars: {}, version: 1 }
    }
}

async function writeCacheManifest(cache: GrammarCacheManifest): Promise<void> {
    await mkdir(grammarCacheDir(), { recursive: true })
    await writeFile(
        grammarCacheManifestPath(),
        `${JSON.stringify(cache, null, 2)}\n`,
    )
}

function cachedGrammarPath(definition: GrammarDefinition): string {
    return join(grammarCacheDir(), `${definition.id}.wasm`)
}

function grammarCacheManifestPath(): string {
    return join(grammarCacheDir(), 'manifest.json')
}

function grammarCacheDir(): string {
    return join(os.homedir(), '.cache', 'konteks', 'grammars')
}

function loadGrammarRegistry(value: unknown): GrammarDefinition[] {
    if (!Array.isArray(value)) {
        throw new Error('Grammar registry must be an array.')
    }

    const grammars = value.map((entry, index) =>
        validateGrammarDefinition(entry, index),
    )
    validateGrammarRegistry(grammars)

    return grammars.map(grammar => ({
        ...grammar,
        latestUrl:
            grammar.latestUrl ??
            `https://registry.npmjs.org/${grammar.package}/latest`,
    }))
}

function validateGrammarDefinition(
    value: unknown,
    index: number,
): GrammarDefinition {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Grammar registry entry ${index} must be an object.`)
    }

    const entry = value as Record<string, unknown>
    const grammar: GrammarDefinition = {
        aliases: stringArrayField(entry, 'aliases', index),
        displayName: stringField(entry, 'displayName', index),
        extensions: stringArrayField(entry, 'extensions', index),
        fallbackVersion: stringField(entry, 'fallbackVersion', index),
        gitRepoUrl: stringField(entry, 'gitRepoUrl', index),
        id: stringField(entry, 'id', index),
        latestUrl:
            typeof entry.latestUrl === 'string' ? entry.latestUrl : undefined,
        package: stringField(entry, 'package', index),
        wasmFile: stringField(entry, 'wasmFile', index),
    }

    if (grammar.extensions.length === 0) {
        throw new Error(
            `Grammar registry entry "${grammar.id}" must declare extensions.`,
        )
    }

    return grammar
}

function validateGrammarRegistry(grammars: GrammarDefinition[]): void {
    const ids = new Set<string>()
    const extensions = new Map<string, string>()
    let previousId = ''

    for (const grammar of grammars) {
        if (ids.has(grammar.id)) {
            throw new Error(`Duplicate Tree-sitter grammar id: ${grammar.id}`)
        }
        ids.add(grammar.id)

        if (previousId && previousId.localeCompare(grammar.id) > 0) {
            throw new Error(
                `Grammar registry must be sorted by id: ${previousId} before ${grammar.id}`,
            )
        }
        previousId = grammar.id

        for (const extension of grammar.extensions) {
            const normalized = extension.toLowerCase()
            const owner = extensions.get(normalized)
            if (owner) {
                throw new Error(
                    `Grammar extension "${extension}" is used by both ${owner} and ${grammar.id}.`,
                )
            }
            extensions.set(normalized, grammar.id)
        }
    }
}

function stringField(
    entry: Record<string, unknown>,
    field: string,
    index: number,
): string {
    const value = entry[field]
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
            `Grammar registry entry ${index} must include string field "${field}".`,
        )
    }
    return value
}

function stringArrayField(
    entry: Record<string, unknown>,
    field: string,
    index: number,
): string[] {
    const value = entry[field]
    if (
        !Array.isArray(value) ||
        !value.every(item => typeof item === 'string')
    ) {
        throw new Error(
            `Grammar registry entry ${index} must include string array field "${field}".`,
        )
    }
    return value
}

function normalizeSelectedGrammars(values: string[]): string[] {
    const valid = new Set(registry.map(grammar => grammar.id))
    return [...new Set(values)].filter(value => valid.has(value))
}

function isStale(checkedAt: string | undefined, ttlHours: number): boolean {
    if (ttlHours <= 0 || !checkedAt) {
        return true
    }
    const timestamp = Date.parse(checkedAt)
    if (Number.isNaN(timestamp)) {
        return true
    }
    return Date.now() - timestamp > ttlHours * 60 * 60 * 1000
}

function sha256Hex(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
