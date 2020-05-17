import { map, right } from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/pipeable'
import * as Filter from './filter'
import { LogRecord } from './logger'
import { rightOrThrow } from './utils'

/**
 * State
 */

let defaults: Filter.Defaults = { level: { comp: 'gte', value: 'trace' } }

/**
 * Primary helpers
 */

function parse(pattern: string) {
  return Filter.parse(defaults, pattern)
}

/**
 * Tests
 */

// prettier-ignore
describe('parse', () => {
  // wildcards
  it('*',       () => { expect(parse('*')).toMatchSnapshot() })
  it('*@*',     () => { expect(parse('*@*')).toMatchSnapshot() })
  it('*@1',     () => { expect(parse('*@1')).toMatchSnapshot() })
  it('app@*',   () => { expect(parse('app@*')).toMatchSnapshot() })
  it('app*',    () => { expect(parse('app*')).toMatchSnapshot() })
  it('app*@*',  () => { expect(parse('app*@*')).toMatchSnapshot() })
  it('app*@1',  () => { expect(parse('app*@*')).toMatchSnapshot() })
  // negate
  it('!a',      () => { expect(parse('!a')).toMatchSnapshot() })
  // paths
  it('a',       () => { expect(parse('a')).toMatchSnapshot() })
  it('a:b',     () => { expect(parse('a:b')).toMatchSnapshot() })
  // lists
  it('a,b',     () => { expect(parse('a,b')).toMatchSnapshot() })
  it(',,a,b',   () => { expect(parse(',,a,b')).toMatchSnapshot() })
  it(', ,  a,', () => { expect(parse(', ,  a')).toMatchSnapshot() })
  // levels
  it.each([
    ['a@trace', { comp:'eq', value:'trace' }],
    ['a@debug', { comp:'eq', value:'debug' }],
    ['a@info', { comp:'eq', value:'info' }],
    ['a@warn', { comp:'eq', value:'warn' }],
    ['a@error', { comp:'eq', value:'error' }],
    ['a@fatal', { comp:'eq', value:'fatal' }],
    ['a@1', { comp:'eq', value:'trace' }],
    ['a@2', { comp:'eq', value:'debug' }],
    ['a@3', { comp:'eq', value:'info' }],
    ['a@4', { comp:'eq', value:'warn' }],
    ['a@5', { comp:'eq', value:'error' }],
    ['a@6', { comp:'eq', value:'fatal' }],
    ['a@6-', { comp:'lte', value:'fatal' }],
    ['a@6+', { comp:'gte', value:'fatal' }],
    ['a@*', { comp:'eq', value:'*' }],
  ] as ([string,Filter.Parsed['level']])[])
  ('%s', (pattern, expectedLevel) => {
    expect(pipe(parse(pattern)[0], map(p => p.level))).toEqual(right(expectedLevel))
  })
})

// prettier-ignore
describe('parse syntax errors', () => {

  it('<empty>', () => { expect(parse('')).toMatchSnapshot() })
  it('**', () => { expect(parse('**')).toMatchSnapshot() })
  it('*a', () => { expect(parse('*a')).toMatchSnapshot() })
  it('*+', () => { expect(parse('*+')).toMatchSnapshot() })
  it('a@', () => { expect(parse('a@')).toMatchSnapshot() })
  it('@', () => { expect(parse('@')).toMatchSnapshot() })
  it('a@*-', () => { expect(parse('a@*-')).toMatchSnapshot() })
  it('a@*+', () => { expect(parse('a@*+')).toMatchSnapshot() })
  it(',', () => { expect(parse(',')).toMatchSnapshot() })
  it('a@+*', () => { expect(parse('a@+*')).toMatchSnapshot() })
  it('a+', () => { expect(parse('a+')).toMatchSnapshot() })
  it('!', () => { expect(parse('!')).toMatchSnapshot() })
  it('a!', () => { expect(parse('a!')).toMatchSnapshot() })
  it('a@*!', () => { expect(parse('a@*!')).toMatchSnapshot() })
})

describe('test', () => {
  type Cases = [Filter.Defaults, string, LogRecord, boolean][]

  it.each([
    // wildcard
    [defaults, '*', rec(), true],
    [defaults, '*@*', rec(), true],
    // negate
    [defaults, '!foo', rec({ path: ['foo'] }), false],
    [defaults, '!foo', rec({ path: ['foo', 'bar'] }), true],
    // negate + wildcard
    [defaults, '!foo*', rec({ path: ['foo'] }), false],
    [defaults, '!foo:*', rec({ path: ['foo'] }), true],
    [defaults, '!foo:*', rec({ path: ['foo', 'bar'] }), false],
    // level
    [defaults, '*@2', rec({ level: 1 }), false],
    [defaults, '*@fatal', rec({ level: 6 }), true],
    [defaults, '*@fatal-', rec({ level: 1 }), true],
    [defaults, '*@warn+,app@debug+', rec({ level: 4 }), true],
    [defaults, '*@warn+,app@debug+', rec({ level: 3 }), false],
    [defaults, '*@warn+,app@debug+', rec({ level: 3, path: ['app'] }), true],
    // path
    [defaults, 'foo', rec({ path: ['bar'] }), false],
    // path + wildcard
    [defaults, 'foo:*', rec({ path: ['foo', 'bar'] }), true],
    [defaults, 'foo:*', rec({ path: ['foo'] }), false],
    [defaults, 'foo*', rec({ path: ['foo'] }), true],
    // list
    [defaults, 'foo,bar', rec({ path: ['bar'] }), true],
    // misc
    // filtered out by later pattern
    [defaults, 'foo:*,!foo:bar', rec({ path: ['foo', 'bar'] }), false],
    [defaults, 'foo,!foo', rec({ path: ['foo'] }), false],
    // defaults
    [{ level: { comp: 'eq', value: 'debug' } }, '*', rec({ level: 1 }), false],
    [{ level: { comp: 'eq', value: 'debug' } }, 'foo', rec({ path: ['foo'], level: 3 }), false],
    [{ level: { comp: 'eq', value: 'debug' } }, 'foo', rec({ path: ['foo'], level: 2 }), true],
  ] as Cases)('%j %s %j %s', (defaults, pattern, rec, shouldPassOrNot) => {
    expect(Filter.test(Filter.parse(defaults, pattern).map(rightOrThrow), rec)).toBe(shouldPassOrNot)
  })
})

describe('processLogFilterInput', () => {
  it.todo('renders sensitive to 1 pattern 1 error')
  it.todo('renders sensitive to n patterns 1 error')
  it.todo('renders sensitive to n patterns <n errors')
  it.todo('renders sensitive to n patterns =n errors')
  it.todo('if some of the given filter patterns are valid and invalid, only valid are returned')
  it.todo('if all of the given filter patterns are invalid, null is returned')
})

/**
 * Secondary Helpers
 */

function rec(data?: Partial<Pick<LogRecord, 'level' | 'path'>>): LogRecord {
  return {
    // overridable
    path: ['root'],
    level: 1,
    // overrides
    ...data,
    // not overridable
    event: 'foo',
    context: {},
  }
}
