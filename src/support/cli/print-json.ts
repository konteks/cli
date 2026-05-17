import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'

export default function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
