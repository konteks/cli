import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const productionFiles = walk('src').filter(
    path =>
        path.endsWith('.ts') &&
        !path.endsWith('.test.ts') &&
        !path.endsWith('.d.ts'),
)

const rules = [
    {
        forbidden: [
            '@/actions/',
            '@/composition/',
            '@/controllers/',
            '../../actions/',
            '../../composition/',
            '../../controllers/',
            '../actions/',
            '../composition/',
            '../controllers/',
        ],
        root: 'src/providers/',
    },
    {
        forbidden: [
            '@/actions/',
            '@/composition/',
            '@/controllers/',
            '../actions/',
            '../composition/',
            '../controllers/',
        ],
        root: 'src/memory/',
    },
    {
        forbidden: [
            '@/actions/',
            '@/composition/',
            '@/controllers/',
            '../actions/',
            '../composition/',
            '../controllers/',
        ],
        root: 'src/extraction/',
    },
    {
        forbidden: [
            '@/actions/',
            '@/composition/',
            '@/controllers/',
            '../actions/',
            '../composition/',
            '../controllers/',
        ],
        root: 'src/project/',
    },
] as const

const offenders = productionFiles.flatMap(path => {
    const rule = rules.find(candidate => path.startsWith(candidate.root))
    if (!rule) {
        return []
    }

    const content = readFileSync(path, 'utf8')
    return extractImports(content)
        .filter(source =>
            rule.forbidden.some(forbidden => source.startsWith(forbidden)),
        )
        .map(source => ({ path, source }))
})

if (offenders.length > 0) {
    console.error('Architecture boundary violations:')
    for (const offender of offenders) {
        console.error(`- ${offender.path} imports ${offender.source}`)
    }
    process.exitCode = 1
}

function extractImports(content: string): string[] {
    const sources: string[] = []
    const importPattern =
        /\bimport(?:\s+type)?(?:\s+[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gu
    let match = importPattern.exec(content)

    while (match) {
        sources.push(match[1])
        match = importPattern.exec(content)
    }

    return sources
}

function walk(directory: string): string[] {
    return readdirSync(directory).flatMap(name => {
        const path = join(directory, name)
        const stat = statSync(path)
        return stat.isDirectory() ? walk(path) : [path]
    })
}
