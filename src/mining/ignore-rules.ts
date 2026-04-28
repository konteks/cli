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

export const defaultMaxMineFileBytes = 512 * 1024

export function shouldIgnoreRelativePath(relativePath: string): boolean {
    const normalized = relativePath.replaceAll('\\', '/')
    const parts = normalized.split('/').filter(Boolean)
    const fileName = parts.at(-1) ?? ''

    if (parts.some(part => ignoredDirectoryNames.has(part))) {
        return true
    }

    if (ignoredFileNames.has(fileName) || fileName.startsWith('.env.')) {
        return true
    }

    return ignoredExtensions.has(extensionOf(fileName))
}

function extensionOf(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.')
    return dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}
