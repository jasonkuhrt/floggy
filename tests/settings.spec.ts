import * as Logger from '../src'
import { createMockOutput, MockOutput, resetBeforeEachTest } from './__helpers'

let log: Logger.RootLogger
let output: MockOutput

resetBeforeEachTest(process, 'env')

beforeEach(() => {
  process.env.LOG_PRETTY = 'false'
  output = createMockOutput()
  log = Logger.create({ output, pretty: { timeDiff: false } })
  process.stdout.columns = 200
})

describe('pretty', () => {
  describe('.enabled', () => {
    it('can be disabled', () => {
      expect(Logger.create({ pretty: { enabled: false } }).settings.pretty.enabled).toEqual(false)
    })
    it('persists across peer field changes', () => {
      const l = Logger.create({ pretty: { enabled: false } })
      l.settings({ pretty: { color: false } })
      expect(l.settings.pretty).toEqual({
        enabled: false,
        color: false,
        levelLabel: false,
        timeDiff: true,
      })
    })
    // it('controls if logs are rendered pretty or as JSON', () => {
    //   if (!process.version.match(/^v12/)) return
    //   output.captureConsoleLog()
    //   log.info('foo')
    //   Logger.demo(log)
    //   expect(output.memory.jsonOrRaw).toMatchSnapshot()
    // })
    describe('precedence', () => {
      it('considers instnace time config first', () => {
        process.stdout.isTTY = false
        process.env.LOG_PRETTY = 'false'
        const l = Logger.create({ pretty: false })
        l.settings({ pretty: true })
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then considers construction time config', () => {
        process.stdout.isTTY = false
        process.env.LOG_PRETTY = 'false'
        const l = Logger.create({ pretty: true })
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then considers LOG_PRETTY env var true|false (case insensitive)', () => {
        process.stdout.isTTY = false
        process.env.LOG_PRETTY = 'tRuE'
        const l = Logger.create()
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then defaults to process.stdout.isTTY', () => {
        delete process.env.LOG_PRETTY // pre-test logic forces false otherwise
        process.stdout.isTTY = true
        const l = Logger.create()
        expect(l.settings.pretty.enabled).toEqual(true)
      })
    })
  })

  describe('.color', () => {
    it('controls if pretty logs have color or not', () => {
      log.settings({ pretty: { enabled: true, color: false } })
      log.info('foo', { qux: true })
      expect(output.memory.jsonOrRaw).toMatchSnapshot()
    })
    it('can be disabled', () => {
      expect(Logger.create({ pretty: { enabled: false, color: false } }).settings.pretty.color).toEqual(false)
    })
    it('is true by default', () => {
      expect(Logger.create({ pretty: { enabled: true } }).settings.pretty).toEqual({
        enabled: true,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
      expect(Logger.create({ pretty: { enabled: false } }).settings.pretty).toEqual({
        enabled: false,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })
    it('persists across peer field changes', () => {
      const l = Logger.create({
        pretty: { enabled: false, color: false },
      })
      l.settings({ pretty: { enabled: true } })
      expect(l.settings.pretty).toEqual({
        enabled: true,
        color: false,
        levelLabel: false,
        timeDiff: true,
      })
    })
  })
  describe('.levelLabel', () => {
    it('is false by default', () => {
      expect(Logger.create().settings.pretty.levelLabel).toEqual(false)
    })
    it('can be enabled', () => {
      expect(Logger.create({ pretty: { levelLabel: true } }).settings.pretty.levelLabel).toEqual(true)
      expect(Logger.create().settings({ pretty: { levelLabel: true } }).settings.pretty.levelLabel).toEqual(
        true
      )
    })
    it('persists across peer field changes', () => {
      const l = Logger.create({ pretty: { levelLabel: true } })
      l.settings({ pretty: false })
      expect(l.settings.pretty.levelLabel).toBe(true)
    })
    it('controls if label is spelt out or not', () => {
      log.settings({
        pretty: { enabled: true, levelLabel: true, color: false },
      })
      log.fatal('foo')
      log.error('foo')
      log.warn('foo')
      log.info('foo')
      log.debug('foo')
      log.trace('foo')
      expect(output.memory.jsonOrRaw).toMatchSnapshot()
    })
  })
  describe('.timeDiff', () => {
    it('is true by default', () => {
      expect(Logger.create().settings.pretty.timeDiff).toEqual(true)
    })
    it('can be disabled', () => {
      const l1 = Logger.create({ pretty: { timeDiff: false } })
      expect(l1.settings.pretty.timeDiff).toEqual(false)
      const l2 = Logger.create()
      l2.settings({ pretty: { timeDiff: false } })
      expect(l2.settings.pretty.levelLabel).toEqual(false)
    })
    it('persists across peer field changes', () => {
      const l = Logger.create({ pretty: { timeDiff: false } })
      l.settings({ pretty: false })
      expect(l.settings.pretty.timeDiff).toBe(false)
    })
    it('controls presence of time deltas in gutter', () => {
      log.settings({
        pretty: { enabled: true, color: false, timeDiff: true },
      })
      log.info('a') // prep the next delta, this too unreliable to test
      log.info('b')
      log.info('c')
      const pattern = /^  (?:\d| )\d.*/ // non-deterministic timing here, allow for 1-2 digit ms timings
      expect(output.memory.jsonOrRaw[1]).toMatch(pattern)
      expect(output.memory.jsonOrRaw[2]).toMatch(pattern)
    })
    // todo these tests as unit level to some pure logic functions would be
    // easy... e.g. prettifier.spec.ts ... But then we run the risk of sliding
    // toward testing internals too much :\
    it.todo('renders as secodns if >= 10s')
    it.todo('renders as minutes if >= 100s')
    it.todo('renders as hours if >= 60m')
    it.todo('renders as days if >= 24h')
  })

  describe('shorthands', () => {
    it('true means enabled true', () => {
      expect(Logger.create({ pretty: true }).settings.pretty).toEqual({
        enabled: true,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })

    it('false means enabled false', () => {
      expect(Logger.create({ pretty: false }).settings.pretty).toEqual({
        enabled: false,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })
  })
})

describe('level', () => {
  describe('precedence', () => {
    it('considers instance time config first', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const l = Logger.create({ level: 'fatal' })
      l.settings({ level: 'trace' })
      expect(l.settings.level).toEqual('trace')
    })

    it('then considers construction time config', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const l = Logger.create({ level: 'trace' })
      expect(l.settings.level).toEqual('trace')
    })

    it('then considers LOG_LEVEL env var', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'trace'
      const l = Logger.create()
      expect(l.settings.level).toEqual('trace')
    })

    it('then considers NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      const l = Logger.create()
      expect(l.settings.level).toEqual('info')
    })

    it('then defaults to debug', () => {
      const l = Logger.create()
      expect(l.settings.level).toEqual('debug')
    })
  })

  it('logs below set level are not output', () => {
    log.settings({ level: 'warn' }).info('foo')
    expect(output.memory.jsonOrRaw).toEqual([])
  })

  it('LOG_LEVEL env var config is treated case insensitive', () => {
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'TRACE'
    const l = Logger.create()
    expect(l.settings.level).toEqual('trace')
  })

  it('LOG_LEVEL env var config when invalid triggers thrown readable error', () => {
    process.env.LOG_LEVEL = 'ttrace'
    expect(() => Logger.create()).toThrowErrorMatchingInlineSnapshot(
      `"Could not parse environment variable LOG_LEVEL into LogLevel. The environment variable was: ttrace. A valid environment variable must be like: fatal, error, warn, info, debug, trace"`
    )
  })
})

describe('data', () => {
  it('all defaults to false if process.NODE_ENV is not production', () => {
    expect(Logger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": false,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(Logger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": false,
      }
    `)

    process.env.NODE_ENV = 'production'
    expect(Logger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": true,
      }
    `)
  })

  it('merges initial setting with defaults', () => {
    expect(Logger.create({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(Logger.create({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'production'
    expect(Logger.create({ data: { time: false } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": false,
      }
    `)
  })

  it('merges incremental changes with previous state', () => {
    expect(Logger.create().settings({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(Logger.create().settings({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'production'
    expect(Logger.create().settings({ data: { time: false } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": false,
      }
    `)
  })
})
