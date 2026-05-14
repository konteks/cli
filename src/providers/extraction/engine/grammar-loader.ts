import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import registryJson from '@/assets/grammars/registry.json' with { type: 'json' }
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type { Project } from '@/models/project'
import { pathExists } from '@/providers/project/context'
import type { TreeSitterLanguage } from './tree-sitter-engine'

type TreeSitterBootstrapEngine = {
    init(): Promise<void>
    loadLanguage(lang: TreeSitterLanguage, wasmPath: string): Promise<void>
}

export type GrammarDefinition = {
    aliases: string[]
    displayName: string
    extensions: string[]
    fallbackVersion: string
    gitRepoUrl: string
    id: TreeSitterLanguage
    latestUrl?: string
    package: string
    wasmFile: string
}

type GrammarRegistryEntry = Omit<GrammarDefinition, 'id'> & {
    id: string
}

type GrammarCacheEntry = {
    checkedAt: string
    id: TreeSitterLanguage
    package: string
    sha256: string
    version: string
    wasmFile: string
}

type GrammarCacheManifest = {
    grammars: Record<string, GrammarCacheEntry>
    version: 1
}

const registry: GrammarDefinition[] = (
    registryJson as GrammarRegistryEntry[]
).map(entry => ({
    ...entry,
    id: entry.id as TreeSitterLanguage,
    latestUrl:
        entry.latestUrl ?? `https://registry.npmjs.org/${entry.package}/latest`,
}))

export function listGrammarDefinitions(): GrammarDefinition[] {
    return [...registry]
}

export function getGrammarDefinition(
    id: string,
): GrammarDefinition | undefined {
    return registry.find(grammar => grammar.id === id)
}

export function getGrammarForPath(path: string): GrammarDefinition | undefined {
    const lowerPath = path.toLowerCase()
    const fileName = lowerPath.split('/').at(-1) ?? lowerPath
    return registry.find(grammar =>
        grammar.extensions.some(extension =>
            extension.startsWith('.')
                ? lowerPath.endsWith(extension)
                : fileName === extension,
        ),
    )
}

export async function initTreeSitterWithSelectedGrammars(
    engine: TreeSitterBootstrapEngine,
    project: Project,
    options: {
        forceUpdate?: boolean
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<{ loaded: TreeSitterLanguage[]; warnings: string[] }> {
    const selected = normalizeSelectedGrammars(
        project.config.extraction.grammars.selected,
    )
    if (selected.length === 0) {
        return { loaded: [], warnings: [] }
    }

    options.onProgress?.({
        message: `Preparing ${selected.length} Tree-sitter grammars`,
        phase: 'preparation',
        status: 'start',
        total: selected.length,
    })
    await engine.init()
    const cache = await readCacheManifest(project)
    const warnings: string[] = []
    const loaded: TreeSitterLanguage[] = []

    for (const [index, id] of selected.entries()) {
        const definition = getGrammarDefinition(id)
        if (!definition) {
            throw new Error(`Unknown Tree-sitter grammar selected: ${id}`)
        }

        const loadedPath = await ensureCachedGrammar(
            project,
            definition,
            cache,
            {
                forceUpdate: options.forceUpdate,
                onProgress: options.onProgress,
                updateTtlHours:
                    project.config.extraction.grammars.updateTtlHours,
            },
        ).catch(async error => {
            const cached = cachedGrammarPath(project, definition)
            if (await pathExists(cached)) {
                const message = `Using cached ${definition.displayName} grammar; update failed: ${errorMessage(error)}`
                warnings.push(message)
                options.onProgress?.({
                    current: index + 1,
                    message,
                    phase: 'preparation',
                    status: 'progress',
                    total: selected.length,
                })
                return cached
            }
            throw error
        })

        await engine.loadLanguage(definition.id, loadedPath)
        loaded.push(definition.id)
        options.onProgress?.({
            current: index + 1,
            message: `Loaded ${definition.displayName} grammar`,
            phase: 'preparation',
            status: 'progress',
            total: selected.length,
        })
    }

    await writeCacheManifest(project, cache)
    options.onProgress?.({
        message: `Tree-sitter grammars ready: ${loaded.length} loaded`,
        phase: 'preparation',
        status: 'done',
        total: selected.length,
    })

    return { loaded, warnings }
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
    const cache = await readCacheManifest(project)
    let updated = 0
    let reused = 0

    for (const id of selected) {
        const definition = getGrammarDefinition(id)
        if (!definition) {
            throw new Error(`Unknown Tree-sitter grammar selected: ${id}`)
        }
        const before = cache.grammars[id]?.sha256
        await ensureCachedGrammar(project, definition, cache, {
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

    await writeCacheManifest(project, cache)
    return { reused, updated }
}

async function ensureCachedGrammar(
    project: Project,
    definition: GrammarDefinition,
    cache: GrammarCacheManifest,
    options: {
        forceUpdate?: boolean
        onProgress?: ExtractionProgressReporter
        updateTtlHours: number
    },
): Promise<string> {
    const cachedPath = cachedGrammarPath(project, definition)
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
    await mkdir(grammarCacheDir(project), { recursive: true })
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

async function readCacheManifest(
    project: Project,
): Promise<GrammarCacheManifest> {
    const path = grammarCacheManifestPath(project)
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

async function writeCacheManifest(
    project: Project,
    cache: GrammarCacheManifest,
): Promise<void> {
    await mkdir(grammarCacheDir(project), { recursive: true })
    await writeFile(
        grammarCacheManifestPath(project),
        `${JSON.stringify(cache, null, 2)}\n`,
    )
}

function cachedGrammarPath(
    project: Project,
    definition: GrammarDefinition,
): string {
    return join(grammarCacheDir(project), `${definition.id}.wasm`)
}

function grammarCacheManifestPath(project: Project): string {
    return join(grammarCacheDir(project), 'manifest.json')
}

function grammarCacheDir(project: Project): string {
    return join(project.memoryDir, 'cache', 'grammars')
}

function normalizeSelectedGrammars(values: string[]): TreeSitterLanguage[] {
    const valid = new Set(registry.map(grammar => grammar.id))
    return [...new Set(values)].filter((value): value is TreeSitterLanguage =>
        valid.has(value as TreeSitterLanguage),
    )
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
