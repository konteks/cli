export type GrammarDefinition = {
    aliases: string[]
    displayName: string
    downloadUrl: string
    extensions: string[]
    id: string
}

const GRAMMAR_REGISTRY: readonly GrammarDefinition[] = [
    {
        aliases: ['sh'],
        displayName: 'Bash',
        downloadUrl:
            'https://unpkg.com/tree-sitter-bash@0.25.1/tree-sitter-bash.wasm',
        extensions: ['.sh', '.bash', '.zsh'],
        id: 'bash',
    },
    {
        aliases: [],
        displayName: 'C',
        downloadUrl:
            'https://unpkg.com/tree-sitter-c@0.24.1/tree-sitter-c.wasm',
        extensions: ['.c', '.h'],
        id: 'c',
    },
    {
        aliases: ['c++'],
        displayName: 'C++',
        downloadUrl:
            'https://unpkg.com/tree-sitter-cpp@0.23.4/tree-sitter-cpp.wasm',
        extensions: ['.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx'],
        id: 'cpp',
    },
    {
        aliases: ['cs'],
        displayName: 'C#',
        downloadUrl:
            'https://unpkg.com/tree-sitter-c-sharp@0.23.5/tree-sitter-c_sharp.wasm',
        extensions: ['.cs'],
        id: 'csharp',
    },
    {
        aliases: [],
        displayName: 'CSS',
        downloadUrl:
            'https://unpkg.com/tree-sitter-css@0.25.0/tree-sitter-css.wasm',
        extensions: ['.css'],
        id: 'css',
    },
    {
        aliases: [],
        displayName: 'Dart',
        downloadUrl:
            'https://unpkg.com/tree-sitter-dart@1.0.0/tree-sitter-dart.wasm',
        extensions: ['.dart'],
        id: 'dart',
    },
    {
        aliases: [],
        displayName: 'Go',
        downloadUrl:
            'https://unpkg.com/tree-sitter-go@0.25.0/tree-sitter-go.wasm',
        extensions: ['.go'],
        id: 'go',
    },
    {
        aliases: ['htm'],
        displayName: 'HTML',
        downloadUrl:
            'https://unpkg.com/tree-sitter-html@0.23.2/tree-sitter-html.wasm',
        extensions: ['.html', '.htm'],
        id: 'html',
    },
    {
        aliases: [],
        displayName: 'Java',
        downloadUrl:
            'https://unpkg.com/tree-sitter-java@0.23.5/tree-sitter-java.wasm',
        extensions: ['.java'],
        id: 'java',
    },
    {
        aliases: ['js'],
        displayName: 'JavaScript and JSX',
        downloadUrl:
            'https://unpkg.com/tree-sitter-javascript@0.25.0/tree-sitter-javascript.wasm',
        extensions: ['.js', '.mjs', '.cjs', '.jsx'],
        id: 'javascript',
    },
    {
        aliases: [],
        displayName: 'JSDoc',
        downloadUrl:
            'https://unpkg.com/tree-sitter-jsdoc@0.25.0/tree-sitter-jsdoc.wasm',
        extensions: ['.jsdoc'],
        id: 'jsdoc',
    },
    {
        aliases: ['kt'],
        displayName: 'Kotlin',
        downloadUrl:
            'https://unpkg.com/@tree-sitter-grammars/tree-sitter-kotlin@1.1.0/tree-sitter-kotlin.wasm',
        extensions: ['.kt', '.kts'],
        id: 'kotlin',
    },
    {
        aliases: [],
        displayName: 'Lua',
        downloadUrl:
            'https://unpkg.com/@tree-sitter-grammars/tree-sitter-lua@0.4.1/tree-sitter-lua.wasm',
        extensions: ['.lua'],
        id: 'lua',
    },
    {
        aliases: ['phtml'],
        displayName: 'PHP',
        downloadUrl:
            'https://unpkg.com/tree-sitter-php@0.24.2/tree-sitter-php.wasm',
        extensions: ['.php', '.phtml'],
        id: 'php',
    },
    {
        aliases: ['py'],
        displayName: 'Python',
        downloadUrl:
            'https://unpkg.com/tree-sitter-python@0.23.6/tree-sitter-python.wasm',
        extensions: ['.py'],
        id: 'python',
    },
    {
        aliases: ['rb'],
        displayName: 'Ruby',
        downloadUrl:
            'https://unpkg.com/tree-sitter-ruby@0.23.1/tree-sitter-ruby.wasm',
        extensions: ['.rb'],
        id: 'ruby',
    },
    {
        aliases: ['rs'],
        displayName: 'Rust',
        downloadUrl:
            'https://unpkg.com/tree-sitter-rust@0.24.0/tree-sitter-rust.wasm',
        extensions: ['.rs'],
        id: 'rust',
    },
    {
        aliases: [],
        displayName: 'Scala',
        downloadUrl:
            'https://unpkg.com/tree-sitter-scala@0.24.0/tree-sitter-scala.wasm',
        extensions: ['.scala', '.sc'],
        id: 'scala',
    },
    {
        aliases: ['swift'],
        displayName: 'Swift',
        downloadUrl:
            'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.2-pypi/tree-sitter-swift.wasm',
        extensions: ['.swift'],
        id: 'swift',
    },
    {
        aliases: [],
        displayName: 'TSX',
        downloadUrl:
            'https://unpkg.com/tree-sitter-typescript@0.23.2/tree-sitter-tsx.wasm',
        extensions: ['.tsx'],
        id: 'tsx',
    },
    {
        aliases: ['ts', 'mts', 'cts'],
        displayName: 'TypeScript',
        downloadUrl:
            'https://unpkg.com/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm',
        extensions: ['.ts', '.mts', '.cts'],
        id: 'typescript',
    },
    {
        aliases: ['zir'],
        displayName: 'Zig',
        downloadUrl:
            'https://unpkg.com/@tree-sitter-grammars/tree-sitter-zig@1.1.2/tree-sitter-zig.wasm',
        extensions: ['.zig'],
        id: 'zig',
    },
] as const

export default GRAMMAR_REGISTRY
