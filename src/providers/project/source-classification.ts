type SourceRole =
    | 'agent_config'
    | 'agent_reference'
    | 'app_code'
    | 'generated'
    | 'implementation_plan'
    | 'package_config'
    | 'product_doc'
    | 'test_code'
    | 'tooling_config'
    | 'unknown'

type MinedLanguage =
    | 'bash'
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'css'
    | 'dockerfile'
    | 'go'
    | 'html'
    | 'java'
    | 'javascript'
    | 'jsdoc'
    | 'json'
    | 'jsx'
    | 'kotlin'
    | 'lua'
    | 'markdown'
    | 'tsx'
    | 'typescript'
    | 'typescript_declaration'
    | 'php'
    | 'python'
    | 'ruby'
    | 'rust'
    | 'scala'
    | 'sql'
    | 'swift'
    | 'toml'
    | 'unknown'
    | 'xml'
    | 'yaml'

const packageConfigFiles = new Set([
    'package.json',
    'bunfig.toml',
    'tsconfig.json',
])

const toolingConfigFiles = new Set([
    'biome.json',
    'knip.json',
    'turbo.json',
    'vite.config.ts',
    'vitest.config.ts',
    'tsup.config.ts',
])

export function detectLanguage(path: string): MinedLanguage {
    const lowerPath = path.toLowerCase()

    if (lowerPath.endsWith('.d.ts')) {
        return 'typescript_declaration'
    }
    if (/\.(ts|mts|cts)$/u.test(lowerPath)) {
        return 'typescript'
    }
    if (lowerPath.endsWith('.tsx')) {
        return 'tsx'
    }
    if (/\.(js|mjs|cjs)$/u.test(lowerPath)) {
        return 'javascript'
    }
    if (lowerPath.endsWith('.jsx')) {
        return 'jsx'
    }
    if (/\.(md|mdx)$/u.test(lowerPath)) {
        return 'markdown'
    }
    if (/\.(json|jsonc)$/u.test(lowerPath)) {
        return 'json'
    }
    if (/\.(html|htm)$/u.test(lowerPath)) {
        return 'html'
    }
    if (/\.(php|phtml)$/u.test(lowerPath)) {
        return 'php'
    }
    if (lowerPath.endsWith('.css')) {
        return 'css'
    }
    if (lowerPath.endsWith('.toml')) {
        return 'toml'
    }
    if (lowerPath.endsWith('.py')) {
        return 'python'
    }
    if (lowerPath.endsWith('.go')) {
        return 'go'
    }
    if (lowerPath.endsWith('.rs')) {
        return 'rust'
    }
    if (lowerPath.endsWith('.java')) {
        return 'java'
    }
    if (/\.(kt|kts)$/u.test(lowerPath)) {
        return 'kotlin'
    }
    if (lowerPath.endsWith('.rb')) {
        return 'ruby'
    }
    if (/\.(c|h)$/u.test(lowerPath)) {
        return 'c'
    }
    if (/\.(cc|cpp|cxx|hpp|hh|hxx)$/u.test(lowerPath)) {
        return 'cpp'
    }
    if (lowerPath.endsWith('.cs')) {
        return 'csharp'
    }
    if (/\.(sh|bash|zsh)$/u.test(lowerPath)) {
        return 'bash'
    }
    if (lowerPath.endsWith('.sql')) {
        return 'sql'
    }
    if (lowerPath.endsWith('.lua')) {
        return 'lua'
    }
    if (lowerPath.endsWith('.swift')) {
        return 'swift'
    }
    if (/\.(scala|sc)$/u.test(lowerPath)) {
        return 'scala'
    }
    if (lowerPath.endsWith('dockerfile') || lowerPath.endsWith('.dockerfile')) {
        return 'dockerfile'
    }
    if (lowerPath.endsWith('.xml')) {
        return 'xml'
    }
    if (lowerPath.endsWith('.jsdoc')) {
        return 'jsdoc'
    }
    if (/\.(ya?ml)$/u.test(lowerPath)) {
        return 'yaml'
    }

    return 'unknown'
}

export function classifySourceRole(path: string): SourceRole {
    const lowerPath = path.toLowerCase()
    const fileName = lowerPath.split('/').at(-1) ?? lowerPath

    if (isGeneratedPath(lowerPath)) {
        return 'generated'
    }
    if (packageConfigFiles.has(fileName)) {
        return 'package_config'
    }
    if (toolingConfigFiles.has(fileName) || lowerPath.startsWith('.github/')) {
        return 'tooling_config'
    }
    if (lowerPath.startsWith('.agents/skills/')) {
        return 'agent_reference'
    }
    if (
        lowerPath.startsWith('.agents/') ||
        lowerPath.startsWith('.codex/') ||
        lowerPath.startsWith('.cursor/')
    ) {
        return 'agent_config'
    }
    if (lowerPath.startsWith('.specs/') || lowerPath.includes('plan.md')) {
        return 'implementation_plan'
    }
    if (lowerPath.includes('.test.') || lowerPath.includes('.spec.')) {
        return 'test_code'
    }
    if (fileName === 'readme.md' || fileName.endsWith('.md')) {
        return 'product_doc'
    }
    if (isCodePath(lowerPath)) {
        return 'app_code'
    }

    return 'unknown'
}

export function extractTopics(path: string, text: string): string[] {
    const words = [
        ...splitWords(path.replace(/\.[^.]+$/u, '')),
        ...splitWords(text.slice(0, 2000)),
    ]
    const counts = new Map<string, number>()

    for (const word of words) {
        if (word.length < 3 || stopWords.has(word)) {
            continue
        }
        counts.set(word, (counts.get(word) ?? 0) + 1)
    }

    return [...counts.entries()]
        .sort(
            (left, right) =>
                right[1] - left[1] || left[0].localeCompare(right[0]),
        )
        .slice(0, 12)
        .map(([word]) => word)
}

function isGeneratedPath(path: string): boolean {
    return (
        path.includes('/generated/') ||
        path.includes('/__generated__/') ||
        path.includes('/vendor/') ||
        path.endsWith('.min.js') ||
        path.endsWith('.min.css')
    )
}

function isCodePath(path: string): boolean {
    return /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|rs|java|kt|rb|php)$/u.test(
        path,
    )
}

function splitWords(value: string): string[] {
    return value
        .replace(/([a-z])([A-Z])/gu, '$1 $2')
        .split(/[^A-Za-z0-9]+/u)
        .map(word => word.toLowerCase())
        .filter(Boolean)
}

const stopWords = new Set([
    'and',
    'are',
    'const',
    'export',
    'for',
    'from',
    'function',
    'import',
    'into',
    'return',
    'that',
    'the',
    'this',
    'type',
    'with',
])
