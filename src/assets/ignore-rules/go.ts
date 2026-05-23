import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.test'],
    generatedFileSuffixes: ['.pb.go', '.grpc.pb.go'],
    generatedPathFragments: ['/vendor/'],
    lockFileNames: ['go.sum'],
} satisfies IgnoreRuleSet
