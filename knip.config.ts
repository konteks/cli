import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    entry: ['src/**/*.test.ts'],
    ignore: [
        'src/domain/entities/*.ts',
        'src/application/interfaces/*.ts',
        'src/domain/repositories/*.ts',
        'src/infrastructure/persistence/sqlite/sqlite-memory-repository.ts',
    ],
    ignoreDependencies: [
        'tree-sitter-html',
        'tree-sitter-javascript',
        'tree-sitter-jsdoc',
        'tree-sitter-json',
        'tree-sitter-php',
        'tree-sitter-typescript',
    ],
    ignoreExportsUsedInFile: true,
    project: ['src/**/*.ts'],
}

export default knipConfig
