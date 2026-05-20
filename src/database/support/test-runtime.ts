export function isSqliteTestRuntime(): boolean {
    return process.env.KONTEKS_SQLITE_TEST_DATABASE === 'memory'
}
