import { chalk } from '../chalk.js'
import { LogRecord } from '../logger.js'
import { spanChar } from '../utils.js'
import { Renderer } from './index.js'
import * as OS from 'node:os'
import { beforeEach, describe, expect, it } from 'vitest'

const makeRec = (data?: Omit<Partial<LogRecord>, 'event'>): LogRecord => {
  return {
    level: 1,
    path: [`foob`],
    ...data,
    event: `foo` // do not allow changing b/c headers width below depends on this value
  }
}

const render = (): string => {
  return Renderer.render(options, rec)
}

let options: Renderer.Options
let rec: LogRecord
let terminalWidth: number
let terminalContextWidth: number

beforeEach(() => {
  const logHeadersWidth = (`● root foo` + Renderer.separators.context.singleLine.symbol).length
  chalk.level = 0 // disable color
  options = {
    color: false, // only disables color of util.inspect
    levelLabel: false,
    timeDiff: false
  }
  rec = makeRec()
  terminalWidth = 100
  terminalContextWidth = terminalWidth - logHeadersWidth
  process.stdout.columns = terminalWidth
})

describe(`singleline`, () => {
  it(`used if context does fit singleline`, () => {
    rec.context = createContext({
      key: { size: terminalContextWidth }
    })
    const l = render()
    expect(l).toMatchInlineSnapshot(`
"— foob foo  --  key: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
"
`)
    expect(trimTrailingNewline(l).length).toBeLessThanOrEqual(terminalWidth)
  })
  it(`used if context does fit singleline (multiple key-values)`, () => {
    rec.context = createContext({
      ke1: { size: terminalContextWidth / 2 },
      ke2: {
        size: terminalContextWidth / 2 - Renderer.separators.contextEntry.singleLine.length
      }
    })
    const l = render()
    expect(l).toMatchInlineSnapshot(`
"— foob foo  --  ke1: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'  ke2: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
"
`)
    expect(trimTrailingNewline(l).length).toBeLessThanOrEqual(terminalWidth)
  })
  // it('objects are formatted by util.inspect compact: yes', () => {
  //   if (!process.version.match(/^v12/)) return
  //   log.info('foo', { ke1: { a: { b: { c: true } } } })
  //   expect(output.memoryOrRaw).toMatchSnapshot()
  // })
})

describe(`multiline`, () => {
  it(`used if context does not fit singleline`, () => {
    rec.context = createContext({
      key: { size: terminalContextWidth + 1 /* force multi */ }
    })
    expect(render()).toMatchInlineSnapshot(`
"— foob foo
  | key  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
"
`)
  })

  it(`used if context does fit singleline (multiple key-values)`, () => {
    rec.context = createContext({
      ke1: { size: terminalContextWidth / 2 },
      ke2: {
        size:
          terminalContextWidth / 2 - Renderer.separators.contextEntry.singleLine.length + 1 /* force multi */
      }
    })
    expect(render()).toMatchInlineSnapshot(`
"— foob foo
  | ke1  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  | ke2  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
"
`)
  })

  // it('objects are formatted by util.inspect compact: yes', () => {
  //   if (!process.version.match(/^v12/)) return
  //   log.info('foo', {
  //     ke1: {
  //       a: {
  //         b: {
  //           c: true,
  //           d: 'looooooooooooooooooooooooooooooooooooooooooooooooong',
  //         },
  //       },
  //     },
  //   })
  //   expect(output.memoryOrRaw).toMatchSnapshot()
  // })
})

// helpers for building content for tests against log formatting

const stringSpan = (size: number): string => {
  const actualSize = size - 2 // -2 for quote rendering "'...'"
  const value = spanChar(actualSize, `x`)
  return value
}

const createContext = (spec: Record<string, { size: number }>) => {
  return Object.entries(spec).reduce((acc, [k, v]) => {
    return {
      ...acc,
      [k]: stringSpanKey(k, v.size)
    }
  }, {})
}

const stringSpanKey = (keyName: string, size: number): string => {
  const KeyWidth = keyName.length + Renderer.separators.contextKeyVal.singleLine.symbol.length
  return stringSpan(size - KeyWidth)
}

/**
 * Remove traiing newline. Strict alternative to .trim().
 */
const trimTrailingNewline = (s: string): string => {
  return s.replace(new RegExp(OS.EOL + `$`), ``)
}
