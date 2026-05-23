import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.class', '.ear', '.jar', '.war'],
    directoryNames: ['.gradle', '.mvn', 'target'],
    generatedPathFragments: [
        '/build/generated/',
        '/generated-sources/',
        '/target/generated-sources/',
    ],
    lockFileNames: ['gradle.lockfile'],
} satisfies IgnoreRuleSet
