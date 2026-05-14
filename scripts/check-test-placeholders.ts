import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const forbiddenPatterns = [
    /exposes its runtime exports/u,
    /exposes type exports/u,
    /expect\(true\)\.toBe\(true\)/u,
]

const offenders = walk('src')
    .filter(path => path.endsWith('.test.ts'))
    .flatMap(path => {
        const content = readFileSync(path, 'utf8')
        return forbiddenPatterns
            .filter(pattern => pattern.test(content))
            .map(pattern => ({ path, pattern: pattern.source }))
    })

if (offenders.length > 0) {
    console.error('Placeholder-style tests are not allowed:')
    for (const offender of offenders) {
        console.error(`- ${offender.path}: ${offender.pattern}`)
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
