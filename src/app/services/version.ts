import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const VERSION = readPackageVersion()

function readPackageVersion(): string {
    const cliDir = dirname(fileURLToPath(import.meta.url))
    const candidates = [
        join(cliDir, '..', 'package.json'),
        join(cliDir, '..', '..', 'package.json'),
        join(cliDir, '..', '..', '..', 'package.json'),
    ]

    for (const path of candidates) {
        try {
            const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
                version?: unknown
            }
            if (typeof parsed.version === 'string') {
                return parsed.version
            }
        } catch {
            // Keep checking other package locations.
        }
    }

    // Keep --version usable even if package metadata is unavailable.
    return '0.0.0'
}
