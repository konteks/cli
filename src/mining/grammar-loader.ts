import { join } from 'node:path'
import { pathExists } from '../project/context.js'
import type { TreeSitterEngine } from './tree-sitter-engine.js'

export async function initTreeSitterWithBundledGrammars(engine: TreeSitterEngine) {
    await engine.init()
    
    // In v0.1 we heuristic-find them in node_modules for dev
    // and expect them in a certain place for production
    const nodeModulesPath = join(process.cwd(), 'node_modules')
    
    const grammars = [
        {
            lang: 'javascript' as const,
            path: join(nodeModulesPath, 'tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
        },
        {
            lang: 'typescript' as const,
            path: join(nodeModulesPath, 'tree-sitter-typescript', 'tree-sitter-typescript.wasm'),
        },
        {
            lang: 'tsx' as const,
            path: join(nodeModulesPath, 'tree-sitter-typescript', 'tree-sitter-tsx.wasm'),
        },
    ]

    for (const grammar of grammars) {
        if (await pathExists(grammar.path)) {
            await engine.loadLanguage(grammar.lang, grammar.path)
        }
    }
}
