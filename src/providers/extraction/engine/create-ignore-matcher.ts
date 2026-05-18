const ignoredDirectoryNames = new Set([
    '.cache',
    '.git',
    '.konteks',
    '.next',
    '.turbo',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'vendor',
])

const ignoredFileNames = new Set([
    '.DS_Store',
    '.env',
    'bun.lock',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'memory.sqlite',
    'npm-debug.log',
    'pnpm-debug.log',
    'yarn-debug.log',
])

const ignoredExtensions = new Set([
    '.7z',
    '.avif',
    '.bin',
    '.bmp',
    '.db',
    '.exe',
    '.gif',
    '.gz',
    '.ico',
    '.jpeg',
    '.jpg',
    '.key',
    '.mov',
    '.mp3',
    '.mp4',
    '.pdf',
    '.pem',
    '.png',
    '.sqlite',
    '.tar',
    '.webp',
    '.zip',
])

export const defaultMaxExtractFileBytes = 512 * 1024

export type IgnoreMatcher = {
    explain(relativePath: string): IgnoreReason | undefined
    ignores(relativePath: string): boolean
}

export type IgnoreReason =
    | 'binary'
    | 'generated'
    | 'hard_directory'
    | 'ignored_file'
    | 'konteksignore'
    | 'lockfile'
    | 'minified'
    | 'secret'
    | 'vcs_ignore'

type IgnorePattern = {
    negated: boolean
    onlyDirectory: boolean
    pattern: string
    rootRelative: boolean
}

function getHardIgnoreReason(relativePath: string): IgnoreReason | undefined {
    const normalized = relativePath.replaceAll('\\', '/')
    const parts = normalized.split('/').filter(Boolean)
    const fileName = parts.at(-1) ?? ''

    if (parts.some(part => ignoredDirectoryNames.has(part))) {
        return 'hard_directory'
    }

    if (parts.some(part => part.startsWith('.konteks-mcp-dry-run-'))) {
        return 'hard_directory'
    }

    const generatedReason = generatedOrMinifiedReason(normalized)
    if (generatedReason) {
        return generatedReason
    }

    if (isLockfile(fileName)) {
        return 'lockfile'
    }

    if (fileName === '.env' || fileName.startsWith('.env.')) {
        return 'secret'
    }

    if (ignoredFileNames.has(fileName)) {
        return 'ignored_file'
    }

    if (isSecretExtension(fileName)) {
        return 'secret'
    }

    if (ignoredExtensions.has(extensionOf(fileName))) {
        return 'binary'
    }

    return undefined
}

export default function createIgnoreMatcher(input: {
    gitignore?: string
    konteksignore?: string
}): IgnoreMatcher {
    const gitignorePatterns = parseIgnoreFile(input.gitignore ?? '', {
        allowNegation: true,
    })
    const konteksignorePatterns = parseIgnoreFile(input.konteksignore ?? '', {
        allowNegation: false,
    })

    return {
        explain(relativePath) {
            const normalized = relativePath.replaceAll('\\', '/')
            const hardReason = getHardIgnoreReason(normalized)
            if (hardReason) {
                return hardReason
            }
            if (matchesPatterns(normalized, gitignorePatterns)) {
                return 'vcs_ignore'
            }
            if (matchesPatterns(normalized, konteksignorePatterns)) {
                return 'konteksignore'
            }

            return undefined
        },
        ignores(relativePath) {
            return this.explain(relativePath) !== undefined
        },
    }
}

function parseIgnoreFile(
    content: string,
    options: { allowNegation: boolean },
): IgnorePattern[] {
    return content
        .split(/\r?\n/u)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .map(line => {
            const negated = options.allowNegation && line.startsWith('!')
            const rawPattern = negated ? line.slice(1) : line
            const rootRelative = rawPattern.startsWith('/')
            const pattern = rawPattern.replace(/^\/+/u, '').replace(/\/+$/u, '')

            return {
                negated,
                onlyDirectory: rawPattern.endsWith('/'),
                pattern,
                rootRelative,
            }
        })
        .filter(pattern => pattern.pattern.length > 0)
}

function matchesPatterns(path: string, patterns: IgnorePattern[]): boolean {
    let ignored = false

    for (const pattern of patterns) {
        if (!matchesPattern(path, pattern)) {
            continue
        }
        ignored = !pattern.negated
    }

    return ignored
}

function matchesPattern(path: string, pattern: IgnorePattern): boolean {
    if (pattern.onlyDirectory) {
        return matchesPathOrDescendant(path, pattern)
    }

    if (pattern.pattern.includes('*')) {
        return matchesGlob(path, pattern)
    }

    if (pattern.rootRelative || pattern.pattern.includes('/')) {
        return (
            path === pattern.pattern || path.startsWith(`${pattern.pattern}/`)
        )
    }

    return path.split('/').includes(pattern.pattern)
}

function matchesPathOrDescendant(
    path: string,
    pattern: IgnorePattern,
): boolean {
    if (pattern.rootRelative || pattern.pattern.includes('/')) {
        return (
            path === pattern.pattern || path.startsWith(`${pattern.pattern}/`)
        )
    }

    return path.split('/').includes(pattern.pattern)
}

function matchesGlob(path: string, pattern: IgnorePattern): boolean {
    const regex = globToRegex(pattern.pattern)

    if (pattern.rootRelative || pattern.pattern.includes('/')) {
        return regex.test(path)
    }

    return path.split('/').some(part => regex.test(part))
}

function globToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
        .replace(/\*/gu, '[^/]*')
        .replace(/\?/gu, '[^/]')

    return new RegExp(`^${escaped}$`, 'u')
}

function generatedOrMinifiedReason(path: string): IgnoreReason | undefined {
    const lowerPath = path.toLowerCase()
    const fileName = lowerPath.split('/').at(-1) ?? lowerPath

    if (
        lowerPath.includes('/__generated__/') ||
        lowerPath.includes('/generated/') ||
        lowerPath.includes('/vendor/')
    ) {
        return 'generated'
    }

    if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) {
        return 'minified'
    }

    return undefined
}

function isLockfile(fileName: string): boolean {
    return (
        fileName === 'bun.lock' ||
        fileName === 'package-lock.json' ||
        fileName === 'pnpm-lock.yaml' ||
        fileName === 'yarn.lock'
    )
}

function isSecretExtension(fileName: string): boolean {
    const extension = extensionOf(fileName)
    return extension === '.key' || extension === '.pem'
}

function extensionOf(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.')
    return dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}
