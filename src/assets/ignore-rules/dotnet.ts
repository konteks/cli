import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.dll', '.nupkg', '.pdb'],
    directoryNames: ['obj', 'testresults'],
    fileNames: ['project.assets.json'],
    lockFileNames: ['packages.lock.json'],
} satisfies IgnoreRuleSet
