export type IgnoreRuleSet = {
    binaryExtensions?: readonly string[]
    directoryNames?: readonly string[]
    fileNames?: readonly string[]
    generatedFileSuffixes?: readonly string[]
    generatedPathFragments?: readonly string[]
    lockFileNames?: readonly string[]
    minifiedFileSuffixes?: readonly string[]
    secretExtensions?: readonly string[]
    secretFileNames?: readonly string[]
}
