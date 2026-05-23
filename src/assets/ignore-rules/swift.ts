import type { IgnoreRuleSet } from './types'

export default {
    directoryNames: ['.swiftpm', 'deriveddata'],
    generatedFileSuffixes: ['.pb.swift'],
    lockFileNames: ['package.resolved'],
} satisfies IgnoreRuleSet
