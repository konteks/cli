import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    entry: ['src/**/*.test.ts'],
    ignoreDependencies: [
        '@huggingface/transformers',
        '@inquirer/prompts',
        'tree-sitter-javascript',
        'tree-sitter-typescript',
        'web-tree-sitter',
    ],
    project: ['src/**/*.ts'],
}

export default knipConfig
