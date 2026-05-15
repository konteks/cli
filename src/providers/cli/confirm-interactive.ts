import { confirm } from '@inquirer/prompts'
import { terminal } from '@/support/terminal/service'

export default async function confirmInteractive(
    message: string,
    defaultValue: boolean,
): Promise<boolean> {
    if (!terminal.stdinIsInteractive() || !terminal.stderrIsInteractive()) {
        return defaultValue
    }

    return confirm({
        default: defaultValue,
        message,
    })
}
