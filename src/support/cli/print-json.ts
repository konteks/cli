import consoleOutput from '@/support/console-output'
import { stringifyPretty } from '@/support/json/io'

export default function printJson(value: unknown): void {
    consoleOutput.print(stringifyPretty(value))
}
