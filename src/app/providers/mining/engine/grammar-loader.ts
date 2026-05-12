import { join, resolve } from 'node:path'
import { pathExists } from '@/app/providers/file-system/context'
import grammarManifest from './grammars/manifest.json' with { type: 'json' }
import type { TreeSitterLanguage } from './tree-sitter-engine'

type TreeSitterBootstrapEngine = {
    init(): Promise<void>
    loadLanguage(lang: TreeSitterLanguage, wasmPath: string): Promise<void>
}

type BundledGrammar = {
    aliases: string[]
    extensions: string[]
    language: TreeSitterLanguage
    package: string
    sha256: string
    url: string
    version: string
    wasmFile: string
}

type GrammarManifest = {
    runtime: string
    manifestVersion: number
    grammars: Record<string, BundledGrammar>
}

const bundledManifest = grammarManifest as GrammarManifest

export function getBundledGrammarForPath(
    path: string,
): BundledGrammar | undefined {
    const lowerPath = path.toLowerCase()
    return Object.values(bundledManifest.grammars).find(grammar =>
        grammar.extensions.some(extension => lowerPath.endsWith(extension)),
    )
}

export async function initTreeSitterWithBundledGrammars(
    engine: TreeSitterBootstrapEngine,
) {
    await engine.init()

    const candidateRoots = resolveCandidateRoots()
    for (const grammar of Object.values(bundledManifest.grammars)) {
        for (const root of candidateRoots) {
            const wasmPath = join(root, grammar.package, grammar.wasmFile)
            if (await pathExists(wasmPath)) {
                await engine.loadLanguage(grammar.language, wasmPath)
                break
            }
        }
    }
}

function resolveCandidateRoots(): string[] {
    return [resolve(process.cwd(), 'node_modules')]
}
