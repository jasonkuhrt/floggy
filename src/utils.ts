import { format } from 'util'
/**
 * Guarantee the length of a given string, padding before or after with the
 * given character. If the given string is longer than  the span target, then it
 * will be cropped.
 */
export function span(
  padSide: 'padBefore' | 'padAfter',
  padChar: string,
  target: number,
  content: string
): string {
  if (content.length > target) {
    return content.slice(0, target)
  }
  let toPadSize = target - content.length
  while (toPadSize > 0) {
    if (padSide === 'padAfter') {
      content = content + padChar
    } else if (padSide === 'padBefore') {
      content = padChar + content
    }
    toPadSize--
  }
  return content
}

/**
 * Guarantee the length of a given string, padding with space as needed. Content
 * is aligned left and if exceeds span target length to begin with gets cropped.
 */
export const clampSpace = span.bind(null, 'padAfter', ' ')

/**
 * Create a string of space of the given length.
 */
export function spanSpace(num: number): string {
  return spanChar(num, ' ')
}

/**
 * Create a string of the given length and character
 */
export function spanChar(num: number, char: string): string {
  return range(num).map(constant(char)).join('')
}

/**
 * Guarantee the length of a given string, padding with space as needed. Content
 * is aligned right and if exceeds span target length to begin with gets cropped.
 */
export const spanSpaceRight = span.bind(null, 'padBefore', ' ')

/**
 * Use this to make assertion at end of if-else chain that all members of a
 * union have been accounted for.
 */
export function casesHandled(x: never): never {
  throw new Error(`A case of value was not handled: ${x}`)
}

/**
 * Create a function that will only ever return the given value when called.
 */
export function constant<T>(x: T): () => T {
  return function () {
    return x
  }
}

/**
 * Create a range of integers.
 */
export function range(times: number): number[] {
  const list: number[] = []
  while (list.length < times) {
    list.push(list.length + 1)
  }
  return list
}

/**
 * Strip keys from object whose value is undefined.
 */
export function omitUndefinedKeys<T extends Record<string, unknown>>(data: T): T {
  return Object.entries(data ?? {})
    .filter(([k, v]) => v !== undefined)
    .reduce((acc, [k, v]) => Object.assign(acc, { [k]: v }), {} as T)
}

/**
 * Get the last item of an array.
 */
export function last<T>(xs: T[]): T {
  return xs[xs.length - 1]
}

export function isEmpty(x?: object): boolean {
  if (x === undefined) return true
  return Object.values(x).filter((val) => val !== undefined).length === 0
}

/**
 * Run a given parser over an environment variable. If parsing fails, throw a
 * contextual error message.
 */
export function parseFromEnvironment<T>(
  key: string,
  parser: {
    info: { valid: string; typeName: string }
    run: (raw: string) => null | T
  }
): T {
  const envVarValue = process.env[key]! // assumes env presence handled before
  const result = parser.run(envVarValue)

  if (result === null) {
    throw new Error(
      `Could not parse environment variable ${key} into ${
        parser.info.typeName
      }. The environment variable was: ${format(envVarValue)}. A valid environment variable must be like: ${
        parser.info.valid
      }`
    )
  }

  return result
}
