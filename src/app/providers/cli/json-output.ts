import { parseJsonInput, stringifyPretty } from '@/app/support/json/io'
import { isRecord } from '@/app/support/object/value'
import { terminal } from '@/app/support/terminal/service'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
