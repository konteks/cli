import { confirm } from '@inquirer/prompts'

export async function confirmInteractive(
    message: string,
    defaultValue: boolean,
): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        return defaultValue
    }

    return confirm({
        default: defaultValue,
        message,
    })
}
