import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const srcTests = walk('src').filter(path => path.endsWith('.test.ts'))
const misplacedTests = walk('tests').filter(
    path =>
        path.endsWith('.test.ts') &&
        !path.startsWith('tests/features/') &&
        !path.startsWith('tests/units/'),
)

if (srcTests.length > 0 || misplacedTests.length > 0) {
    if (srcTests.length > 0) {
        console.error('Tests must not live under src:')
        for (const path of srcTests) {
            console.error(`- ${path}`)
        }
    }

    if (misplacedTests.length > 0) {
        console.error('Tests must live under tests/features or tests/units:')
        for (const path of misplacedTests) {
            console.error(`- ${path}`)
        }
    }

    process.exitCode = 1
}

function walk(directory: string): string[] {
    try {
        return readdirSync(directory).flatMap(name => {
            const path = join(directory, name)
            const stat = statSync(path)
            return stat.isDirectory() ? walk(path) : [path]
        })
    } catch {
        return []
    }
}
