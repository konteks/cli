import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.rlib'],
    directoryNames: ['target'],
    generatedPathFragments: ['/target/generated-sources/'],
    lockFileNames: ['cargo.lock'],
} satisfies IgnoreRuleSet
