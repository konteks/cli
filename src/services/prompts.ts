import { confirm } from '@/services/interactive-prompts'
import { terminal } from '@/services/terminal'

export async function confirmInteractive(
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
