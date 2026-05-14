import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const missingTests = walk('src')
    .filter(
        path =>
            path.endsWith('.ts') &&
            !path.endsWith('.test.ts') &&
            !path.endsWith('.d.ts'),
    )
    .map(source => ({
        source,
        test: source.replace(/\.ts$/u, '.test.ts'),
    }))
    .filter(({ test }) => !fileExists(test))

if (missingTests.length > 0) {
    console.error('Missing colocated tests:')
    for (const { source, test } of missingTests) {
        console.error(`- ${source} -> ${test}`)
    }
    process.exitCode = 1
}

function walk(directory: string): string[] {
    return readdirSync(directory).flatMap(name => {
        const path = join(directory, name)
        const stat = statSync(path)
        return stat.isDirectory() ? walk(path) : [path]
    })
}

function fileExists(path: string): boolean {
    try {
        return statSync(path).isFile()
    } catch {
        return false
    }
}
