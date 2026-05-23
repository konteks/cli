import type { IgnoreRuleSet } from './types'

export default {
    directoryNames: ['.bundle', 'vendor'],
    lockFileNames: ['gemfile.lock'],
} satisfies IgnoreRuleSet
