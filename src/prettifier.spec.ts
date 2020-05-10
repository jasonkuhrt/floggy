import * as OS from 'os'
import { chalk } from './chalk'
import { LogRecord } from './logger'
import * as Prettifier from './prettifier'
import { spanChar } from './utils'

function makeRec(data?: Omit<Partial<LogRecord>, 'event'>): LogRecord {
  return {
    hostname: 'host',
    pid: 0,
    time: 0,
    level: 10,
    path: ['root'],
    context: {},
    ...data,
    event: 'foo', // do not allow changing b/c headers width below depends on this value
  }
}

function render(): string {
  return Prettifier.render(options, rec)
}

let options: Prettifier.Options
let rec: LogRecord
let terminalWidth: number
let terminalContextWidth: number

beforeEach(() => {
  let logHeadersWidth = ('● root foo' + Prettifier.separators.context.singleLine.symbol).length
  chalk.level = 0 // disable color
  options = {
    color: false, // only disables color of util.inspect
    levelLabel: false,
    timeDiff: false,
  }
  rec = makeRec()
  terminalWidth = 100
  terminalContextWidth = terminalWidth - logHeadersWidth
  process.stdout.columns = terminalWidth
})

describe('singleline', () => {
  it('used if context does fit singleline', () => {
    rec.context = stringValueEntryWithin('key', terminalContextWidth)
    const l = render()
    expect(l).toMatchSnapshot()
    expect(trimTrailingNewline(l).length).toBeLessThanOrEqual(terminalWidth)
  })
  it('used if context does fit singleline (multiple key-values)', () => {
    rec.context = {
      ...stringValueEntryWithin('ke1', terminalContextWidth / 2),
      ...stringValueEntryWithin(
        'ke2',
        terminalContextWidth / 2 - Prettifier.separators.contextEntry.singleLine.length
      ),
    }
    const l = render()
    expect(l).toMatchSnapshot()
    expect(trimTrailingNewline(l).length).toBeLessThanOrEqual(terminalWidth)
  })
  // it('objects are formatted by util.inspect compact: yes', () => {
  //   if (!process.version.match(/^v12/)) return
  //   log.info('foo', { ke1: { a: { b: { c: true } } } })
  //   expect(output.memory.jsonOrRaw).toMatchSnapshot()
  // })
})

describe('multiline', () => {
  it('used if context does not fit singleline', () => {
    rec.context = stringValueEntryWithin('key', terminalContextWidth + 1 /* force multi */)
    expect(render()).toMatchSnapshot()
  })

  it('used if context does fit singleline (multiple key-values)', () => {
    rec.context = {
      ...stringValueEntryWithin('ke1', terminalContextWidth / 2),
      ...stringValueEntryWithin(
        'ke2',
        terminalContextWidth / 2 - Prettifier.separators.contextEntry.singleLine.length + 1 /* force multi */
      ),
    }
    expect(render()).toMatchSnapshot()
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
  //   expect(output.memory.jsonOrRaw).toMatchSnapshot()
  // })
})

// helpers for building content for tests against log formatting

function stringValueWithin(size: number): string {
  const actualSize = size - 2 // -2 for quote rendering "'...'"
  const value = spanChar(actualSize, 'x')
  return value
}

function stringValueEntryWithin(keyName: string, size: number): Record<any, any> {
  const KeyWidth = keyName.length + Prettifier.separators.contextKeyVal.singleLine.symbol.length
  return {
    [keyName]: stringValueWithin(size - KeyWidth),
  }
}

/**
 * Remove traiing newline. Strict alternative to .trim().
 */
function trimTrailingNewline(s: string): string {
  return s.replace(new RegExp(OS.EOL + '$'), '')
}
