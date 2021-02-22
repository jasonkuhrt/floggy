import * as Logger from '../src'
import * as RootLogger from '../src/root-logger'
import {
  createMockOutput,
  mockConsoleLog,
  MockOutput,
  resetBeforeEachTest,
  unmockConsoleLog
} from './__helpers'

let log: Logger.RootLogger
let output: MockOutput

resetBeforeEachTest(process, 'env')

beforeEach(() => {
  process.env.LOG_PRETTY = 'false'
  output = createMockOutput()
  log = RootLogger.create({ output, pretty: { timeDiff: false } })
  process.stdout.columns = 200
})

describe('pretty', () => {
  describe('.enabled', () => {
    it('can be disabled', () => {
      expect(RootLogger.create({ pretty: { enabled: false } }).settings.pretty.enabled).toEqual(false)
    })
    it('persists across peer field changes', () => {
      const l = RootLogger.create({ pretty: { enabled: false } })
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
        const l = RootLogger.create({ pretty: false })
        l.settings({ pretty: true })
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then considers construction time config', () => {
        process.stdout.isTTY = false
        process.env.LOG_PRETTY = 'false'
        const l = RootLogger.create({ pretty: true })
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then considers LOG_PRETTY env var true|false (case insensitive)', () => {
        process.stdout.isTTY = false
        process.env.LOG_PRETTY = 'tRuE'
        const l = RootLogger.create()
        expect(l.settings.pretty.enabled).toEqual(true)
      })
      it('then defaults to process.stdout.isTTY', () => {
        delete process.env.LOG_PRETTY // pre-test logic forces false otherwise
        process.stdout.isTTY = true
        const l = RootLogger.create()
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
      expect(RootLogger.create({ pretty: { enabled: false, color: false } }).settings.pretty.color).toEqual(
        false
      )
    })
    it('is true by default', () => {
      expect(RootLogger.create({ pretty: { enabled: true } }).settings.pretty).toEqual({
        enabled: true,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
      expect(RootLogger.create({ pretty: { enabled: false } }).settings.pretty).toEqual({
        enabled: false,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })
    it('persists across peer field changes', () => {
      const l = RootLogger.create({
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
      expect(RootLogger.create().settings.pretty.levelLabel).toEqual(false)
    })
    it('can be enabled', () => {
      expect(RootLogger.create({ pretty: { levelLabel: true } }).settings.pretty.levelLabel).toEqual(true)
      expect(
        RootLogger.create().settings({ pretty: { levelLabel: true } }).settings.pretty.levelLabel
      ).toEqual(true)
    })
    it('persists across peer field changes', () => {
      const l = RootLogger.create({ pretty: { levelLabel: true } })
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
      expect(RootLogger.create().settings.pretty.timeDiff).toEqual(true)
    })
    it('can be disabled', () => {
      const l1 = RootLogger.create({ pretty: { timeDiff: false } })
      expect(l1.settings.pretty.timeDiff).toEqual(false)
      const l2 = RootLogger.create()
      l2.settings({ pretty: { timeDiff: false } })
      expect(l2.settings.pretty.levelLabel).toEqual(false)
    })
    it('persists across peer field changes', () => {
      const l = RootLogger.create({ pretty: { timeDiff: false } })
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
      expect(RootLogger.create({ pretty: true }).settings.pretty).toEqual({
        enabled: true,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })

    it('false means enabled false', () => {
      expect(RootLogger.create({ pretty: false }).settings.pretty).toEqual({
        enabled: false,
        color: true,
        levelLabel: false,
        timeDiff: true,
      })
    })
  })
})

describe('filter', () => {
  describe('precedence', () => {
    it('considers instance time config first', () => {
      process.env.LOG_FILTER = 'from_env_var'
      const l = RootLogger.create({ filter: { pattern: '*@fatal' } })
      l.settings({ filter: { pattern: 'foo' } })
      expect(l.settings.filter.patterns).toMatchSnapshot()
    })

    it('then considers construction time config', () => {
      process.env.LOG_FILTER = 'from_env_var'
      const l = RootLogger.create({ filter: { pattern: '*@fatal' } })
      expect(l.settings.filter).toMatchSnapshot()
    })

    it('then considers LOG_FILTER env var', () => {
      process.env.LOG_FILTER = 'from_env_var'
      const l = RootLogger.create()
      expect(l.settings.filter).toMatchSnapshot()
    })

    it('then defaults to "*', () => {
      const l = RootLogger.create()
      expect(l.settings.filter).toMatchSnapshot()
    })
  })

  it('can be passed a pattern directly', () => {
    const l = RootLogger.create({ filter: '*@fatal' })
    expect(l.settings.filter.patterns[0]?.level.value).toBe('fatal')
    l.settings({ filter: 'foo' })
    expect(l.settings.filter.patterns[0]?.level.value).toBe('debug')
    l.settings({ filter: { level: 'warn' } })
    expect(l.settings.filter.patterns[0]?.level.value).toBe('warn')
    l.settings({ filter: 'bar' })
    expect(l.settings.filter.patterns[0]?.level.value).toBe('warn')
  })

  it('LOG_FILTER envar config when invalid triggers readable log warning', () => {
    const calls = mockConsoleLog()
    process.env.LOG_FILTER = '**'
    RootLogger.create()
    expect(calls).toMatchSnapshot()
    unmockConsoleLog()
  })
})

describe('level', () => {
  describe('precedence', () => {
    it('considers instance time config first', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const l = RootLogger.create({ filter: { level: 'fatal' } })
      l.settings({ filter: { level: 'trace' } })
      expect(l.settings.filter.patterns[0]?.level.value).toEqual('trace')
    })

    it('then considers construction time config', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const l = RootLogger.create({ filter: { level: 'trace' } })
      expect(l.settings.filter.patterns[0]?.level.value).toEqual('trace')
    })

    it('then considers LOG_LEVEL env var', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'trace'
      const l = RootLogger.create()
      expect(l.settings.filter.patterns[0]?.level.value).toEqual('trace')
    })

    it('then considers NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      const l = RootLogger.create()
      expect(l.settings.filter.patterns[0]?.level.value).toEqual('info')
    })

    it('then defaults to debug', () => {
      const l = RootLogger.create()
      expect(l.settings.filter.patterns[0]?.level.value).toEqual('debug')
    })
  })

  it('logs below set level are not output', () => {
    log.settings({ filter: { level: 'warn' } }).info('foo')
    expect(output.memory.jsonOrRaw).toEqual([])
  })

  it('LOG_LEVEL env var config is treated case insensitive', () => {
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'TRACE'
    const l = RootLogger.create()
    expect(l.settings.filter.patterns[0]?.level.value).toEqual('trace')
  })

  it('LOG_LEVEL env var config when invalid triggers thrown readable error', () => {
    process.env.LOG_LEVEL = 'ttrace'
    expect(() => RootLogger.create()).toThrowErrorMatchingInlineSnapshot(
      `"Could not parse environment variable LOG_LEVEL into LogLevel. The environment variable was: ttrace. A valid environment variable must be like: fatal, error, warn, info, debug, trace"`
    )
  })
})

describe('data', () => {
  it('all defaults to false if process.NODE_ENV is not production', () => {
    expect(RootLogger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": false,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(RootLogger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": false,
      }
    `)

    process.env.NODE_ENV = 'production'
    expect(RootLogger.create().settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": true,
      }
    `)
  })

  it('merges initial setting with defaults', () => {
    expect(RootLogger.create({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(RootLogger.create({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'production'
    expect(RootLogger.create({ data: { time: false } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": false,
      }
    `)
  })

  it('merges incremental changes with previous state', () => {
    expect(RootLogger.create().settings({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'not production'
    expect(RootLogger.create().settings({ data: { time: true } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": false,
        "pid": false,
        "time": true,
      }
    `)
    process.env.NODE_ENV = 'production'
    expect(RootLogger.create().settings({ data: { time: false } }).settings.data).toMatchInlineSnapshot(`
      Object {
        "hostname": true,
        "pid": true,
        "time": false,
      }
    `)
  })
})
