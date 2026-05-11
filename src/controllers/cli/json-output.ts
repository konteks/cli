import { parseJsonInput, stringifyPretty } from '@/services/json'
import { isRecord } from '@/services/object'
import { terminal } from '@/services/terminal'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
