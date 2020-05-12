import * as Filter from './filter'

let defaults: Filter.Defaults = { level: { comp: 'gte', value: 'trace' } }

function parse(pattern: string) {
  return Filter.parse(defaults, pattern)
}

function test() {}

// prettier-ignore
describe('parse', () => {
  const p: Record<string, string> = {}

  // wildcards
  it('*', () => { expect(parse('*')).toMatchSnapshot() })
  it('*@*', () => { expect(parse('*@*')).toMatchSnapshot() })
  it('*@1', () => { expect(parse('*@1')).toMatchSnapshot() })
  it('app@*', () => { expect(parse('app@*')).toMatchSnapshot() })
  it('app*', () => { expect(parse('app*')).toMatchSnapshot() })
  it('app*@*', () => { expect(parse('app*@*')).toMatchSnapshot() })
  it('app*@1', () => { expect(parse('app*@*')).toMatchSnapshot() })
  // negate
  it('!a', () => { expect(parse('!a')).toMatchSnapshot() })
  // paths
  it('a', () => { expect(parse('a')).toMatchSnapshot() })
  it('a:b', () => { expect(parse('a:b')).toMatchSnapshot() })
  // lists
  it('a,b', () => { expect(parse('a,b')).toMatchSnapshot() })
  it(',,a,b', () => { expect(parse(',,a,b')).toMatchSnapshot() })
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
  ('%s', (pattern, expectedLevel) => { expect(parse(pattern)[0].level).toEqual(expectedLevel) })
})

// prettier-ignore
describe('parse syntax errors', () => {
  it('<empty>', () => { expect(() => parse('')).toThrowErrorMatchingSnapshot() })
  it('**', () => { expect(() => parse('**')).toThrowErrorMatchingSnapshot() })
  it('*a', () => { expect(() => parse('*a')).toThrowErrorMatchingSnapshot() })
  it('*+', () => { expect(() => parse('*+')).toThrowErrorMatchingSnapshot() })
  it('a@', () => { expect(() => parse('a@')).toThrowErrorMatchingSnapshot() })
  it('@', () => { expect(() => parse('@')).toThrowErrorMatchingSnapshot() })
  it('a@*-', () => { expect(() => parse('a@*-')).toThrowErrorMatchingSnapshot() })
  it('a@*+', () => { expect(() => parse('a@*+')).toThrowErrorMatchingSnapshot() })
  it(',', () => { expect(() => parse(',')).toThrowErrorMatchingSnapshot() })
  it('a@+*', () => { expect(() => parse('a@+*')).toThrowErrorMatchingSnapshot() })
  it('a+', () => { expect(() => parse('a+')).toThrowErrorMatchingSnapshot() })
  it('!', () => { expect(() => parse('!')).toThrowErrorMatchingSnapshot() })
  it('a!', () => { expect(() => parse('a!')).toThrowErrorMatchingSnapshot() })
  it('a@*!', () => { expect(() => parse('a@*!')).toThrowErrorMatchingSnapshot() })
})

describe('test', () => {})
