import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.a', '.d', '.dylib', '.la', '.lo', '.o', '.obj'],
    directoryNames: [
        '.cmake',
        '.vs',
        'cmake-build-debug',
        'cmake-build-release',
        'cmakefiles',
    ],
    generatedFileSuffixes: ['.pb.cc', '.pb.h', '.grpc.pb.cc'],
} satisfies IgnoreRuleSet
