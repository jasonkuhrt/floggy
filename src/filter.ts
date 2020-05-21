import { Either, isLeft, isRight, left, right } from 'fp-ts/lib/Either'
import { chalk } from './chalk'
import { validPathSegmentNameRegex } from './data'
import * as Level from './level'
import type { LogRecord } from './logger'
import { casesHandled, ContextualError, createContextualError, getLeft, rightOrThrow } from './utils'

// failed to get a singular regex solution https://regex101.com/r/6g6BHc/6
// const validPattern = '...'

// https://regex101.com/r/6g6BHc/9
const validTargetRegex = /^((?:[A-z_]+[A-z_0-9]*)+|\*|\.)(?:(?:@(1|2|3|4|5|6|trace|debug|info|warn|error|fatal)([-+]?))|(@\*))?$/

const symbols = {
  negate: '!',
  pathDelim: ':',
  patternDelim: ',',
  descendants: '*',
  levelDelim: '@',
  levelGte: '+',
  levelLte: '-',
}

export type Parsed = {
  originalInput: string
  level: {
    value: Level.Name | '*'
    comp: 'lte' | 'gte' | 'eq'
  }
  negate: boolean
  path: {
    value: string
    descendants:
      | false
      | {
          includeParent: boolean
        }
  }
}

/**
 * Some of the criteria a pattern can specify are optional. When such criteria
 * are not specified, then these defaults are used.
 */
export type Defaults = {
  level: {
    value: Level.Name
    comp: Parsed['level']['comp']
  }
}

/**
 * Parse a full pattern. This accounts for lists of patterns. This is the parsing entrypoint.
 */
export function parse(defaults: Defaults, pattern: string): Either<ParseError, Parsed>[] {
  // Allow sloppy lists so long as there is at least one pattern given
  const patterns = pattern
    .split(symbols.patternDelim)
    .map((p) => p.trim())
    .filter((p) => p !== '')

  // todo error is at level of group, not single pattern, ...
  if (!patterns.length) {
    return [left(createInvalidPattern(pattern, 'There must be at least one pattern present.'))]
  }

  return patterns.map((p) => parseOne(defaults, p))
}

/**
 * Parse a single pattern. This assumes parsing of "," has already been handled
 * including whitespace trimming around the pattern.
 */
export function parseOne(criteriaDefaults: Defaults, pattern: string): Either<ParseError, Parsed> {
  // todo maybe level default should be wildcard instead...
  const originalInput = pattern
  let level = { ...criteriaDefaults.level } as Parsed['level']
  let path: Parsed['path'] = { value: '', descendants: false }

  if (pattern === '') {
    return left(createInvalidPattern(originalInput))
  }

  const negate = pattern[0] === '!'
  if (negate) {
    pattern = pattern.slice(1)
  }

  const parts = pattern.split(':')
  if (parts[0] !== '.') {
    parts.unshift('.')
  }

  const ex = parts[parts.length - 2] === '' && parts[parts.length - 1][0] === '*'
  if (ex) {
    parts.splice(parts.length - 2, 1)
  }

  const target = parts.pop()

  if (!target) {
    return left(createInvalidPattern(originalInput))
  }

  const prefix = parts.join(':')

  const targetm = target.match(validTargetRegex)

  if (!targetm) {
    return left(createInvalidPattern(originalInput))
  }

  /**
   * build path
   */

  if (targetm[1] === '*') {
    path.descendants = { includeParent: !ex }
    path.value = prefix
  } else if (targetm[1] === '.') {
    path.value = '.'
  } else {
    path.value = prefix.length ? prefix + ':' + targetm[1] : targetm[1]
  }

  /**
   * Build Level
   */
  const levelValue = targetm[2] as undefined | Level.Name | Level.NumString
  const levelDir = targetm[3] as undefined | '-' | '+'
  const levelWildCard = Boolean(targetm[4])
  // encode invariants
  const levelm = levelWildCard
    ? ({ type: 'wildcard' } as const)
    : levelValue
    ? ({ type: 'value', value: levelValue!, dir: levelDir } as const)
    : undefined

  if (levelm) {
    if (levelm.type === 'wildcard') {
      level.value = '*'
      level.comp = 'eq'
    } else {
      // the original regex guarantees 1-5 so we don't have to validate that now
      if (levelm.value.match(/\d/)) {
        level.value = Level.LEVELS_BY_NUM[levelm.value as Level.NumString].label
      } else {
        level.value = levelm.value as Level.Name
      }
      if (levelm.dir === '+') level.comp = 'gte'
      else if (levelm.dir === '-') level.comp = 'lte'
      else if (levelm.dir === '') level.comp = 'eq'
      else if (levelm.dir === undefined) level.comp = 'eq'
      else casesHandled(levelm.dir)
    }
  }

  /**
   * Check For Errors
   */

  if (path.value !== null) {
    const invalidPathPartNames = path.value
      .split(symbols.pathDelim)
      .slice(1) // root
      .filter((pathPart) => !pathPart.match(validPathSegmentNameRegex))

    if (invalidPathPartNames.length) {
      return left(
        createInvalidPattern(
          originalInput,
          `Path segment names must only contain ${String(validPathSegmentNameRegex)}.`
        )
      )
    }
  } else if (path.value === null && !path.descendants) {
    return left(createInvalidPattern(originalInput))
  }

  return right({
    negate,
    path,
    originalInput,
    level,
  })
}

/**
 * Test if a log matches the pattern.
 */
export function test(patterns: Readonly<Parsed[]>, log: LogRecord): boolean {
  let yaynay: null | boolean = null
  for (const pattern of patterns) {
    // if log already passed then we can skip rest except negations
    if (yaynay === true && pattern.negate !== true) continue

    const logPath = log.path ? ['.', ...log.path].join(symbols.pathDelim) : '.'
    // const patternPath = pattern.path.value.replace(/^\.:?/, '')
    let isPass = false

    // test in order of computational cost, short-citcuiting ASAP

    // level

    if (pattern.level.value === '*') {
      isPass = true
    } else {
      isPass = comp(pattern.level.comp, log.level, Level.LEVELS[pattern.level.value].number)
    }

    // path

    // console.log(
    //   require('util').inspect(
    //     {
    //       isPass,
    //       pattern,
    //       logPath,
    //       log,
    //       b:
    //         pattern.path.descendants &&
    //         !pattern.path.descendants.includeParent &&
    //         pattern.path.value === null,
    //     },
    //     { depth: 4 }
    //   )
    // )
    if (isPass) {
      if (pattern.path.descendants && !pattern.path.descendants.includeParent && pattern.path.value === '.') {
        // case of :*
        if (logPath === '.') {
          // log from root logger
          isPass = false
        } else {
          isPass = true
        }
      } else if (
        pattern.path.descendants &&
        pattern.path.descendants.includeParent &&
        pattern.path.value === '.'
      ) {
        // case of *
        isPass = true
      } else if (
        pattern.path.descendants &&
        pattern.path.descendants.includeParent &&
        pattern.path.value !== '.'
      ) {
        // case of <path>:*
        isPass = logPath ? logPath.startsWith(pattern.path.value) : false
      } else if (
        pattern.path.descendants &&
        !pattern.path.descendants.includeParent &&
        pattern.path.value !== '.'
      ) {
        // case of <path>::*
        isPass = logPath ? logPath !== pattern.path.value && logPath.startsWith(pattern.path.value) : false
      } else if (!pattern.path.descendants) {
        isPass = logPath === pattern.path.value
        // isPass = logPath ? logPath === pattern.path.value : false
      } else {
        throw new Error('this should never happen')
      }
    }

    if (yaynay === null) {
      yaynay = pattern.negate ? !isPass : isPass
    } else if (pattern.negate && isPass) {
      // Allow negates to undo previous passes while non-negates can only pass,
      // not unpass.
      yaynay = false
    } else if (isPass) {
      yaynay = true
    }
  }

  if (yaynay === null) {
    throw new Error('Invariant violation: pattern processing did not convert into pass calculation')
  }

  return yaynay
}

function comp(kind: Parsed['level']['comp'], a: number, b: number): boolean {
  if (kind === 'eq') return a === b
  if (kind === 'gte') return a >= b
  if (kind === 'lte') return a <= b
  casesHandled(kind)
}

/**
 * Like `parse` but throws upon any failure.
 *
 * @remarks
 *
 * Only use this if you know what you're doing.
 */
export function parseUnsafe(defaults: Defaults, pattern: string): Parsed[] {
  return parse(defaults, pattern).map(rightOrThrow)
}

type ParseError = ContextualError<{ pattern: string; hint?: string }>

function createInvalidPattern(pattern: string, hint?: string): ParseError {
  return createContextualError(`Invalid filter pattern: "${pattern}${hint ? `. ${hint}` : ''}"`, {
    pattern,
    hint,
  })
}

/**
 * Get the string contents of a manual showing how to write filters.
 */
export function renderSyntaxManual() {
  const m = chalk.magenta
  const b = chalk.blue
  const gray = chalk.gray
  const c = chalk.cyan
  const bold = chalk.bold
  const subtle = (x: string) => gray(x)
  const subtitle = (x: string) => bold(m(x))
  const pipe = gray('|')
  return `${bold(b('LOG FILTERING SYNTAX MANUAL  ⟁'))}
${bold(b(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`))}

${bold(b(`Grammar`))}

    [!][${c(`<root>`)}](*|${c(`<path>`)}[:*])[@(*|(${c(`<levelNum>`)}|${c(`<levelLabel>`)})[+-])] [,<pattern>]

    ${c(`<root>`)}       = .
    ${c(`<path>`)}       = ${validPathSegmentNameRegex.toString().replace(/(^\/|\/$)/g, gray(`$1`))} [:<path>]
    ${c(`<levelNum>`)}   = 1     ${pipe} 2     ${pipe} 3    ${pipe} 4    ${pipe} 5     ${pipe} 6
    ${c(`<levelLabel>`)} = trace ${pipe} debug ${pipe} info ${pipe} warn ${pipe} error ${pipe} fatal

${bold(b(`Examples`))}

    ${subtitle(`Paths`)}
    app         ${subtle(`app path at default level`)}
    app:router  ${subtle(`app router path at default level`)} 

    ${subtitle(`Wildcards Paths`)}
    *           ${subtle(`all paths at default level`)} 
    app:*       ${subtle(`app path and its descendant paths at defualt level`)}
    app::*      ${subtle(`descendant paths of app at defualt level`)}

    ${subtitle(`Negation`)}
    !app        ${subtle(`all paths expect app at default level`)} 

    ${subtitle(`Lists`)}
    app,nexus   ${subtle(`app and nexus paths at default level`)}

    ${subtitle(`Levels`)}
    *@info      ${subtle(`all paths at info level`)}
    *@error-    ${subtle(`all paths at error level or lower`)}
    *@debug+    ${subtle(`all paths at debug level or higher`)}
    *@3         ${subtle(`all paths at info level`)}
    *@4-        ${subtle(`all paths at error level or lower`)}
    *@2+        ${subtle(`all paths at debug level or higher`)}

    ${subtitle(`Explicit Root`)}
    .           ${subtle(`only logs from the root logger at defualt level`)}
    .@info      ${subtle(`only logs from the root logger at info level`)}
    .:app       ${subtle(`Same as "app"`)}
    .:*         ${subtle(`Same as "*"`)}

    ${subtitle(`Mixed`)}
    *@*         ${subtle(`all paths at all levels`)}
    app@*       ${subtle(`app path at all levels`)}
    app:*@2+    ${subtle(`descendant paths of app at debug level or higher`)}
    app*@2-     ${subtle(`app & descendant paths of app at debug level or lower`)} 
  `
}

export function renderSyntaxError(input: {
  errPatterns: Either<ParseError, Parsed>[]
  foundIn?: string
  some?: boolean
}): string {
  const badOnes = input.errPatterns.filter(isLeft)
  const multipleInputs = input.errPatterns.length > 1
  const multipleErrors = badOnes.length > 1
  const allBad = badOnes.length === input.errPatterns.length
  const foundIn = `${input.foundIn ? ` found in ${input.foundIn}` : ''}`
  let message

  if (!multipleInputs) {
    const e = getLeft(badOnes[0])
    const pattern = e?.context.pattern
    const hint = e?.context.hint ? `. ${e.context.hint}` : ''
    message = `Your log filter's pattern${foundIn} was invalid: "${chalk.red(
      pattern
    )}${hint}"\n\n${renderSyntaxManual()}`
  } else if (!multipleErrors) {
    const e = getLeft(badOnes[0])
    const pattern = e?.context.pattern
    const hint = e?.context.hint ? `. ${e.context.hint}` : ''
    message = `One of the patterns in your log filter${foundIn} was invalid: "${chalk.red(
      pattern
    )}"${hint}\n\n${renderSyntaxManual()}`
  } else {
    const patterns = badOnes
      .map((e) => {
        const hint = e.left.context.hint ? chalk.gray(`  ${e.left.context.hint}`) : ''
        return `    ${chalk.red(e.left.context.pattern)}${hint}`
      })
      .join('\n')
    const intro = allBad
      ? `All of the patterns in your log filter`
      : `Some (${badOnes.length}) of the patterns in your log filter`
    message = `${intro}${foundIn} were invalid:\n\n${patterns}\n\n${renderSyntaxManual()}`
  }

  return message
}

export function processLogFilterInput(
  defaults: Defaults,
  pattern: string,
  foundIn?: string
): null | Parsed[] {
  const errPatterns = parse(defaults, pattern)
  const goodOnes = errPatterns.filter(isRight)
  const badOnes = errPatterns.filter(isLeft)
  let patterns = null

  if (badOnes.length) {
    if (goodOnes.length) {
      patterns = goodOnes.map(rightOrThrow)
    }
    const message = renderSyntaxError({ errPatterns, foundIn })
    // todo use logger
    // but doing so introduces circ dependency breaking cjs output
    // try ts 3.9 live bindings output?
    // no problem in esm-world
    // log.warn(message)
    console.log(message)
  } else {
    patterns = errPatterns.map(rightOrThrow)
  }

  return patterns
}
