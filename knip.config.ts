import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    entry: ['src/**/*.test.ts'],
    ignoreDependencies: [
        'tree-sitter-html',
        'tree-sitter-javascript',
        'tree-sitter-jsdoc',
        'tree-sitter-json',
        'tree-sitter-php',
        'tree-sitter-typescript',
    ],
}

export default knipConfig
