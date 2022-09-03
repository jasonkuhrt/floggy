// todo
// tests commented out that have:
//   if (!process.version.match(/^v12/)) return
// because they fail in node v10 tests
// either remove them, rewrite them to be agnostic, or find way to run them only
// in v12 test suite

import { beforeEach, describe, expect, it } from 'vitest'
import * as Logger from '../src/index.mjs'
import * as RootLogger from '../src/root-logger.mjs'
import { createMemoryOutput, MemoryOutput, resetBeforeEachTest } from './__helpers.mjs'

// shows up in snapshots of json-mode logs
require('os').hostname = () => 'mock-host'

resetBeforeEachTest(process, 'env')
resetBeforeEachTest(process.stdout, 'isTTY')
resetBeforeEachTest(console, 'log')

let log: Logger.RootLogger
let output: MemoryOutput

beforeEach(() => {
  process.env.LOG_PRETTY = 'false'
  output = createMemoryOutput()
  log = RootLogger.create({ output, pretty: { timeDiff: false } })
  process.stdout.columns = 200
})

describe('root logger path', () => {
  it('is not in the log record', () => {
    RootLogger.create({ output }).info('bar')
    expect('path' in output.memory[0]!).toBe(false)
  })
})

describe('demo', () => {
  // it('runs a demo with fake data, pretty, all levels active', () => {
  //   if (!process.version.match(/^v12/)) return
  //   output.captureConsoleLog()
  //   log.settings({ pretty: { color: false } })
  //   Logger.demo(log)
  //   expect(output.memoryOrRaw).toMatchSnapshot()
  // })
  it.todo('runs automatically when LOG_DEMO=true')
})

describe('output', () => {
  it('defaults to stdout for all levels', () => {
    const logger = RootLogger.create({ pretty: false })
    const writes: string[] = []
    const p = process as any
    const w = p.stdout.write
    p.stdout.write = (m: string) => writes.push(JSON.parse(m))
    logger.fatal('foo')
    p.stdout.write = w
    expect(writes).toMatchSnapshot()
  })
})

describe('.<level> log methods', () => {
  it('accept an event name and optional context', () => {
    log.info('hi', { user: { id: 1 } })
    log.info('bye')
    expect(output.memory).toMatchSnapshot()
  })

  it('one for each log level', () => {
    log.settings({ filter: { level: 'trace' } })
    log.fatal('hi-fatal')
    log.error('hi-error')
    log.warn('hi-warn')
    log.info('hi-info')
    log.debug('hi-debug')
    log.trace('hi-trace')
    expect(output.memory).toMatchSnapshot()
  })
})

describe('.addToContext', () => {
  it('pins context for all subsequent logs from the logger', () => {
    log.addToContext({ user: { id: 1 } })
    log.info('hi')
    expect(output.memory).toMatchSnapshot()
  })

  it('can be called multiple times, merging deeply', () => {
    log.addToContext({ user: { id: 1 } })
    log.addToContext({ user: { name: 'Jill' } })
    log.info('hi')
    expect(output.memory).toMatchSnapshot()
  })

  it('gets deeply merged with local context', () => {
    log.addToContext({ user: { id: 1 } })
    log.info('hi', { user: { name: 'Jill' } })
    expect(output.memory).toMatchSnapshot()
  })

  it('local context takes prescedence over pinned context', () => {
    log.addToContext({ user: { id: 1 } })
    log.info('hi', { user: { id: 2 } })
    expect(output.memory).toMatchSnapshot()
  })
})

describe('.child', () => {
  it('creates a sub logger', () => {
    log.child('tim').info('hi')
    expect(output.memory).toMatchSnapshot()
  })

  it('log output includes path field showing the logger namespacing', () => {
    log.child('b').child('c').child('d').info('foo')
    expect(output.memory[0]?.path).toEqual(['b', 'c', 'd'])
  })

  it('inherits context from parent', () => {
    log.addToContext({ foo: 'bar' }).child('tim').info('hi')
    expect(output.memory[0]?.context).toEqual({ foo: 'bar' })
  })

  it('at log time reflects the current state of parent context', () => {
    const b = log.child('b')
    log.addToContext({ foo: 'bar' })
    b.info('lop')
    expect(output.memory[0]?.context).toEqual({ foo: 'bar' })
  })

  it('at log time reflects the current state of parent context even from further up the chain', () => {
    const b = log.child('b')
    const c = b.child('c')
    const d = c.child('d')
    log.addToContext({ foo: 'bar' })
    d.info('lop')
    expect(output.memory[0]?.context).toEqual({ foo: 'bar' })
  })

  it('inherits level from parent', () => {
    expect(log.settings.filter.patterns[0]?.level.value).toBe('debug')
    log
      .settings({ filter: { level: 'trace' } })
      .child('tim')
      .trace('hi')
    // The fact that we get output for trace log from child means it honored the
    // setLevel.
    expect(output.memory).toMatchSnapshot()
  })

  it('reacts to level changes in root logger', () => {
    const b = log.child('b')
    log.settings({ filter: { level: 'trace' } })
    b.trace('foo')
    // The fact that we get output for trace log from child means it honored the
    // setLevel.
    expect(output.memory).toMatchSnapshot()
  })

  it('is unable to change context of parent', () => {
    log.child('b').addToContext({ foo1: 'bar' })
    log.info('qux1')
    expect(output.memory[0]?.context).toEqual(undefined)
    log.addToContext({ toto: 'one' })
    log.child('b').addToContext({ foo2: 'bar' })
    log.info('qux2')
    expect(output.memory[1]?.context).toEqual({ toto: 'one' })
  })

  it('is unable to change context of siblings', () => {
    const b1 = log.child('b1').addToContext({ from: 'b1' })
    const b2 = log.child('b2').addToContext({ from: 'b2' })
    const b3 = log.child('b3').addToContext({ from: 'b3' })
    log.addToContext({ foo: 'bar' })
    b1.info('foo')
    b2.info('foo')
    b3.info('foo')
    // All should inherit the root context
    expect(output.memory).toMatchSnapshot()
  })

  it('cannot affect level', () => {
    expect((log.child('b') as any).setLevel).toBeUndefined()
  })
})

describe('filtering', () => {
  it('allows logs to be suppressed from outpub', () => {
    const output = createMemoryOutput()
    const log = RootLogger.create({ filter: { pattern: 'foo:bar' }, output })
    const foo = log.child('foo')
    const foobar = foo.child('bar')
    foo.info('beep') // should be filtered out
    foobar.info('boop')
    log.settings({ filter: { pattern: 'qux' } })
    foobar.info('berp') // should be filtered out
    expect(output.memory).toMatchInlineSnapshot(`
      [
        {
          "event": "boop",
          "level": 3,
          "path": [
            "foo",
            "bar",
          ],
        },
      ]
    `)
  })
})
