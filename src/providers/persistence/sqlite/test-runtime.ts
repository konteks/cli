export function isSqliteTestRuntime(): boolean {
    if (process.env.KONTEKS_SQLITE_TEST_DATABASE === 'file') {
        return false
    }

    return (
        process.env.NODE_ENV === 'test' &&
        process.argv.some(argument => argument.includes('.test.'))
    )
}
