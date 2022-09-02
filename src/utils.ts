import { format } from 'node:util'

/**
 * Guarantee the length of a given string, padding before or after with the
 * given character. If the given string is longer than  the span target, then it
 * will be cropped.
 */
export const span = (
  padSide: 'padBefore' | 'padAfter',
  padChar: string,
  target: number,
  content: string
): string => {
  if (content.length > target) {
    return content.slice(0, target)
  }
  let toPadSize = target - content.length
  while (toPadSize > 0) {
    if (padSide === `padAfter`) {
      content = content + padChar
    } else if (padSide === `padBefore`) {
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
export const clampSpace = span.bind(null, `padAfter`, ` `)

/**
 * Create a string of space of the given length.
 */
export const spanSpace = (num: number): string => {
  return spanChar(num, ` `)
}

/**
 * Create a string of the given length and character
 */
export const spanChar = (num: number, char: string): string => {
  return range(num).map(constant(char)).join(``)
}

/**
 * Guarantee the length of a given string, padding with space as needed. Content
 * is aligned right and if exceeds span target length to begin with gets cropped.
 */
export const spanSpaceRight = span.bind(null, `padBefore`, ` `)

/**
 * Use this to make assertion at end of if-else chain that all members of a
 * union have been accounted for.
 */
export const casesHandled = (x: never): never => {
  // eslint-disable-next-line
  throw new Error(`A case of value was not handled: ${x}`)
}

/**
 * Create a function that will only ever return the given value when called.
 */
export const constant = <T>(x: T): (() => T) => {
  return () => {
    return x
  }
}

/**
 * Create a range of integers.
 */
export const range = (times: number): number[] => {
  const list: number[] = []
  while (list.length < times) {
    list.push(list.length + 1)
  }
  return list
}

/**
 * Strip keys from object whose value is undefined.
 */
export const omitUndefinedKeys = <T extends Record<string, unknown>>(data: T): T => {
  return Object.entries(data ?? {})
    .filter(([_, v]) => v !== undefined)
    .reduce((acc, [k, v]) => Object.assign(acc, { [k]: v }), {} as T)
}

/**
 * Get the last item of an array.
 */
export const last = <T>(xs: T[]): T | undefined => {
  return xs[xs.length - 1]
}

// eslint-disable-next-line
export const isEmpty = (x?: object | string): boolean => {
  if (typeof x === `string` && x === ``) return true
  if (x === undefined) return true
  return Object.values(x).filter((val) => val !== undefined).length === 0
}

/**
 * Run a given parser over an environment variable. If parsing fails, throw a
 * contextual error message.
 */
export const parseFromEnvironment = <T>(
  key: string,
  parser: {
    info: { valid: string; typeName: string }
    run: (raw: string) => null | T
  }
): T => {
  // eslint-disable-next-line
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

/**
 * An error with additional contextual data.
 */
// eslint-disable-next-line
export type ContextualError<Context extends Record<string, unknown> = {}> = Error & {
  context: Context
}

/**
 * Create an error with contextual data about it.
 */
export const createContextualError = <Context extends Record<string, unknown>>(
  message: string,
  context: Context
): ContextualError<Context> => {
  const e = new Error(message) as ContextualError<Context>

  Object.defineProperty(e, `message`, {
    enumerable: true,
    value: e.message
  })

  e.context = context

  return e
}
