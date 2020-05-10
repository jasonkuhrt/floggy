import * as Output from '../src/output'

/**
 * A mock output stream useful for passing to logger and later reflecting on the
 * values that it wrote.
 */
export type MockOutput = Output.Output & {
  memory: {
    jsonOrRaw: Array<Record<string, any> | string>
    raw: string[]
    json: Record<string, any>[]
  }
  captureConsoleLog(): void
}

export function createMockOutput(): MockOutput {
  const output = {
    memory: {
      jsonOrRaw: [],
      raw: [],
      json: [],
    },

    captureConsoleLog() {
      console.log = output.write
    },
    write(message: string) {
      output.memory.raw.push(message)
      let log: any
      try {
        log = JSON.parse(message)
        log.time = 0
        log.pid = 0
        output.memory.json.push(log)
      } catch (e) {
        if (e instanceof SyntaxError) {
          // assume pretty mode is on
          log = message
        }
      }
      output.memory.jsonOrRaw.push(log)
    },
  } as MockOutput

  return output
}
