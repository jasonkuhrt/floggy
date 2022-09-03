import * as Lo from 'lodash'
import { beforeEach } from 'vitest'
import * as Output from '../src/output.mjs'

/**
 * A mock output stream useful for passing to logger and later reflecting on the
 * values that it wrote.
 */
export type MemoryOutput = Output.Output & {
  memory: Record<string, any>[]
}

export const createMemoryOutput = (): MemoryOutput => {
  const output: MemoryOutput = {
    memory: [],
    write(record) {
      output.memory.push(record)
    }
  }

  return output
}

/**
 * Restore the key on given object before each test. Useful for permiting tests
 * to modify the environment and so on.
 */
export const resetBeforeEachTest = (object: any, key: string) => {
  const orig = object[key]
  beforeEach(() => {
    if (typeof orig === 'object') {
      object[key] = Lo.cloneDeep(orig)
    } else {
      object[key] = orig
    }
  })
}

export const mockConsoleLog = (): any[][] => {
  ;(console as any).logOriginal = console.log
  const calls = [] as Array<Array<any>>
  console.log = (...args: any[]) => calls.push(args)
  return calls
}

export const unmockConsoleLog = () => {
  console.log = (console as any).logOriginal
}
