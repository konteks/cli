import {
    getGrammarForPath,
    isBundledGrammar,
} from '@/providers/extraction/engine/grammar-loader'

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

const packageConfigFiles = new Set([
    'build.gradle',
    'build.gradle.kts',
    'bunfig.toml',
    'cargo.toml',
    'composer.json',
    'gemfile',
    'go.mod',
    'package.json',
    'package.swift',
    'pom.xml',
    'pubspec.yaml',
    'pyproject.toml',
    'settings.gradle',
    'tsconfig.json',
])

const toolingConfigFiles = new Set([
    'analysis_options.yaml',
    'biome.json',
    'knip.json',
    'phpunit.xml',
    'turbo.json',
    'vite.config.ts',
    'vitest.config.ts',
    'tsup.config.ts',
])

export function detectLanguage(path: string): string {
    const lowerPath = path.toLowerCase()

    if (lowerPath.endsWith('.d.ts')) {
        return 'typescript_declaration'
    }
    if (/\.(md|mdx)$/u.test(lowerPath)) {
        return 'markdown'
    }
    if (lowerPath.endsWith('dockerfile') || lowerPath.endsWith('.dockerfile')) {
        return 'dockerfile'
    }
    if (lowerPath.endsWith('.xml')) {
        return 'xml'
    }

    return getGrammarForPath(path)?.id ?? 'unknown'
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
    if (fileName.endsWith('.csproj') || fileName.endsWith('.sln')) {
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
    const grammar = getGrammarForPath(path)
    return Boolean(grammar && !isBundledGrammar(grammar.id))
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
