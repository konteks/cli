import type { IgnoreRuleSet } from './types'

export default {
    directoryNames: ['.dart_tool', 'build'],
    generatedFileSuffixes: ['.g.dart', '.freezed.dart'],
    lockFileNames: ['pubspec.lock'],
} satisfies IgnoreRuleSet
