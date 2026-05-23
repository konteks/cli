import common from './common'
import cpp from './cpp'
import dart from './dart'
import dotnet from './dotnet'
import go from './go'
import java from './java'
import javascript from './javascript'
import php from './php'
import python from './python'
import ruby from './ruby'
import rust from './rust'
import swift from './swift'
import type { IgnoreRuleSet } from './types'
import zig from './zig'

const ruleSets: readonly IgnoreRuleSet[] = [
    common,
    cpp,
    dart,
    dotnet,
    go,
    java,
    javascript,
    php,
    python,
    ruby,
    rust,
    swift,
    zig,
]

export const ignoreRules = {
    binaryExtensions: normalizedSet('binaryExtensions'),
    directoryNames: normalizedSet('directoryNames'),
    fileNames: normalizedSet('fileNames'),
    generatedFileSuffixes: normalizedValues('generatedFileSuffixes'),
    generatedPathFragments: normalizedValues('generatedPathFragments'),
    lockFileNames: normalizedSet('lockFileNames'),
    minifiedFileSuffixes: normalizedValues('minifiedFileSuffixes'),
    secretExtensions: normalizedSet('secretExtensions'),
    secretFileNames: normalizedSet('secretFileNames'),
}

function normalizedSet(key: keyof IgnoreRuleSet): ReadonlySet<string> {
    return new Set(normalizedValues(key))
}

function normalizedValues(key: keyof IgnoreRuleSet): readonly string[] {
    return ruleSets.flatMap(ruleSet =>
        [...(ruleSet[key] ?? [])].map(value => value.toLowerCase()),
    )
}
