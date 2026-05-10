import { parseJsonInput, stringifyPretty } from '../../../utils/json.js'
import { isRecord } from '../../../utils/object.js'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    console.log(stringifyPretty(value))
}
