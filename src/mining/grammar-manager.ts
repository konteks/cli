import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathExists } from '../project/context.js'
import { getBundledGrammarManifest } from './grammar-loader.js'

type SupportedLanguage = 'javascript' | 'typescript' | 'tsx'

type InstalledGrammarRecord = {
    installedAt: string
    language: SupportedLanguage
    manifestVersion: number
    runtime: string
    sha256: string
    version: string
}

type InstalledMetadata = {
    grammars: Partial<Record<SupportedLanguage, InstalledGrammarRecord>>
}

const installedMetadataFile = 'installed.json'

export function getGlobalGrammarCacheDir(): string {
    if (process.env.KONTEKS_GRAMMAR_CACHE_DIR) {
        return resolve(process.env.KONTEKS_GRAMMAR_CACHE_DIR)
    }
    return join(homedir(), '.cache', 'konteks', 'grammars')
}

export async function listGrammars() {
    const manifest = getBundledGrammarManifest()
    const installed = await readInstalledMetadata()
    return Object.values(manifest.grammars).map(grammar => ({
        installed: Boolean(installed.grammars[grammar.language]),
        installedAt: installed.grammars[grammar.language]?.installedAt ?? null,
        language: grammar.language,
        sourceUrl: grammar.url,
        version: grammar.version,
    }))
}

export async function addGrammar(language: SupportedLanguage) {
    const manifest = getBundledGrammarManifest()
    const grammar = manifest.grammars[language]
    if (!grammar) {
        throw new Error(`Unsupported grammar language: ${language}`)
    }

    const sourcePath = await resolveGrammarSourcePath(
        grammar.package,
        grammar.wasmFile,
    )
    if (!sourcePath) {
        throw new Error(
            `Missing grammar source for ${language}. Expected ${grammar.wasmFile} in configured roots.`,
        )
    }

    const sourceHash = await hashFileSha256(sourcePath)
    if (sourceHash !== grammar.sha256) {
        throw new Error(
            `SHA-256 mismatch for ${language}. Expected ${grammar.sha256}, got ${sourceHash}.`,
        )
    }

    const cacheDir = getGlobalGrammarCacheDir()
    const targetPath = grammarCachePath(
        cacheDir,
        grammar.package,
        grammar.wasmFile,
    )
    await mkdir(dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    const copiedHash = await hashFileSha256(targetPath)
    if (copiedHash !== grammar.sha256) {
        throw new Error(
            `Copied grammar verification failed for ${language}. Expected ${grammar.sha256}, got ${copiedHash}.`,
        )
    }

    const installed = await readInstalledMetadata()
    installed.grammars[language] = {
        installedAt: new Date().toISOString(),
        language,
        manifestVersion: manifest.manifestVersion,
        runtime: manifest.runtime,
        sha256: grammar.sha256,
        version: grammar.version,
    }
    await writeInstalledMetadata(installed)
}

export async function removeGrammar(language: SupportedLanguage) {
    const manifest = getBundledGrammarManifest()
    const grammar = manifest.grammars[language]
    if (!grammar) {
        throw new Error(`Unsupported grammar language: ${language}`)
    }

    const cacheDir = getGlobalGrammarCacheDir()
    const targetPath = grammarCachePath(
        cacheDir,
        grammar.package,
        grammar.wasmFile,
    )
    if (await pathExists(targetPath)) {
        await rm(targetPath, { force: true })
    }

    const installed = await readInstalledMetadata()
    delete installed.grammars[language]
    await writeInstalledMetadata(installed)
}

async function readInstalledMetadata(): Promise<InstalledMetadata> {
    const metadataPath = join(getGlobalGrammarCacheDir(), installedMetadataFile)
    if (!(await pathExists(metadataPath))) {
        return { grammars: {} }
    }
    const raw = await readFile(metadataPath, 'utf8')
    return JSON.parse(raw) as InstalledMetadata
}

async function writeInstalledMetadata(metadata: InstalledMetadata) {
    const metadataPath = join(getGlobalGrammarCacheDir(), installedMetadataFile)
    await mkdir(dirname(metadataPath), { recursive: true })
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))
}

function grammarCachePath(cacheDir: string, pkg: string, wasmFile: string) {
    return join(cacheDir, 'bundled', pkg, wasmFile)
}

async function resolveGrammarSourcePath(
    pkg: string,
    wasmFile: string,
): Promise<string | undefined> {
    const roots: string[] = []
    if (process.env.KONTEKS_GRAMMAR_ROOT) {
        roots.push(resolve(process.env.KONTEKS_GRAMMAR_ROOT))
    }
    roots.push(resolve(process.cwd(), 'node_modules'))

    for (const root of roots) {
        const candidate = join(root, pkg, wasmFile)
        if (await pathExists(candidate)) {
            return candidate
        }
    }
    return undefined
}

async function hashFileSha256(path: string): Promise<string> {
    const bytes = await readFile(path)
    return createHash('sha256').update(bytes).digest('hex')
}
