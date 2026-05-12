import { parseJsonInput, stringifyPretty } from '@/app/support/json'
import { isRecord } from '@/app/support/object'
import { terminal } from '@/app/support/terminal'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
