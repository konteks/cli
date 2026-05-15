import printJson, { isRecord } from '@/support/cli/print-json'
import { terminal } from '@/support/terminal/service'

export default function printMcpCallResult(
    result: unknown,
    options: { json?: boolean } = {},
): void {
    if (options.json) {
        printJson(result)
        return
    }

    const text = extractMcpText(result)
    if (text) {
        terminal.log(text)
        return
    }

    printJson(result)
}

function extractMcpText(result: unknown): string | undefined {
    if (!isRecord(result) || !Array.isArray(result.content)) {
        return undefined
    }

    const texts = result.content
        .map(item =>
            isRecord(item) &&
            item.type === 'text' &&
            typeof item.text === 'string'
                ? item.text
                : undefined,
        )
        .filter((text): text is string => Boolean(text))

    return texts.length > 0 ? texts.join('\n') : undefined
}
