import { terminal } from '@/services/terminal'
import { parseJsonInput, stringifyPretty } from '@/utils/json'
import { isRecord } from '@/utils/object'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
