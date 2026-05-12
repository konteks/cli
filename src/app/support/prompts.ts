import { confirm } from '@/app/support/interactive-prompts'
import { terminal } from './terminal'

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
