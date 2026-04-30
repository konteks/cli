import { join, resolve } from 'node:path'
import { pathExists } from '../project/context.js'
import grammarManifest from './grammars/manifest.json'
import type { TreeSitterEngine } from './tree-sitter-engine.js'

type BundledGrammar = {
    language: 'javascript' | 'typescript' | 'tsx'
    package: string
    wasmFile: string
}

type GrammarManifest = {
    runtime: string
    manifestVersion: number
    grammars: Record<string, BundledGrammar>
}

const bundledManifest = grammarManifest as GrammarManifest

export function getBundledGrammarManifest(): GrammarManifest {
    return bundledManifest
}

export async function initTreeSitterWithBundledGrammars(
    engine: TreeSitterEngine,
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
    const roots: string[] = []
    if (process.env.KONTEKS_GRAMMAR_ROOT) {
        roots.push(resolve(process.env.KONTEKS_GRAMMAR_ROOT))
    }
    roots.push(resolve(process.cwd(), '.konteks', 'grammars', 'bundled'))
    roots.push(resolve(process.cwd(), 'node_modules'))
    return roots
}
