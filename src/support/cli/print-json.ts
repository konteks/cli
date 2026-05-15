import { parseJsonInput, stringifyPretty } from '@/support/json/io'
import { isRecord } from '@/support/object/value'
import { terminal } from '@/support/terminal/service'

export { isRecord, parseJsonInput }

export default function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
