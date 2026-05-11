import { parseJsonInput, stringifyPretty } from '@/utils/json'
import { isRecord } from '@/utils/object'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    console.log(stringifyPretty(value))
}
