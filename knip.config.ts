import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    ignoreDependencies: [
        'tree-sitter-html',
        'tree-sitter-javascript',
        'tree-sitter-jsdoc',
        'tree-sitter-json',
        'tree-sitter-php',
        'tree-sitter-typescript',
    ],
    ignoreFiles: ['src/**/*.test.ts', 'src/support/fake/**'],
}

export default knipConfig
