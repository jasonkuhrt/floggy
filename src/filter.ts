import { Either, isLeft, isRight, left, right } from 'fp-ts/lib/Either'
import * as Level from './level'
import * as Logger from './logger'
import { validPathSegmentNameRegex } from './root-logger'
import { casesHandled, ContextualError, createContextualError, getLeft, last, rightOrThrow } from './utils'

// https://regex101.com/r/6g6BHc/1
// If you change the regex please update the link and vice-versa!
const pathTerminalRegex = /^([A-z_]*)(\*)?(?:(?:@(1|2|3|4|5|6|trace|debug|info|warn|error|fatal)([-+]?))|(@\*))?$/

const symbols = {
  negate: '!',
  pathDelim: ':',
  patternDelim: ',',
  descendents: '*',
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
    descendents:
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

  // if (!patterns.length) {
  // createInvalidPattern(pattern, 'There must be at least one pattern present.')
  // }

  return patterns.map((p) => parseOne(defaults, p))
}

/**
 * Parse a single pattern. This assumes parsing of "," has already been handled
 * including whitespace trimming around the pattern.
 */
export function parseOne(criteriaDefaults: Defaults, pattern: string): Either<ParseError, Parsed> {
  let pattern_ = pattern
  // todo maybe level default should be wildcard instead...
  let level = { ...criteriaDefaults.level } as Parsed['level']
  let negate = false
  let path: Parsed['path'] = { value: '', descendents: false }

  // process negate

  if (pattern_[0] === '!') {
    negate = true
    pattern_ = pattern_.slice(1)
  }

  // process everything else

  let pathParts = pattern_.split(symbols.pathDelim)

  if (last(pathParts).match(validPathSegmentNameRegex)) {
    path.value = pathParts.join(symbols.pathDelim)
  } else {
    const match = last(pathParts).match(pathTerminalRegex)
    if (match) {
      type LevelNumString = '1' | '2' | '3' | '4' | '5' | '6'
      pathParts.pop()
      const pathPart = match[1] as undefined | string
      const descendents = match[2] as undefined | string
      const levelValue = match[3] as undefined | Level.Name | LevelNumString
      const levelDir = match[4] as undefined | '-' | '+'
      const levelWildCard = match[5] as undefined | string

      if (pathPart) {
        path.value = pathParts.concat([pathPart]).join(symbols.pathDelim)
      } else {
        path.value = pathParts.join(symbols.pathDelim)
      }

      if (descendents) {
        path.descendents = {
          includeParent: Boolean(pathPart),
        }
      }

      if (levelValue) {
        // the original regex guarantees 1-5 so we don't have to validate that now
        if (levelValue.match(/\d/)) {
          level.value = Level.LEVELS_BY_NUM[levelValue as LevelNumString].label
        } else {
          level.value = levelValue as Level.Name
        }
        if (levelDir === '+') level.comp = 'gte'
        else if (levelDir === '-') level.comp = 'lte'
        else if (levelDir === '') level.comp = 'eq'
        else if (levelDir === undefined) level.comp = 'eq'
        else casesHandled(levelDir)
      } else if (levelWildCard) {
        level.value = '*'
        level.comp = 'eq'
      }
    } else {
      return left(createInvalidPattern(pattern))
    }
  }

  // check for errors

  if (path.value !== '') {
    const invalidPathPartNames = path.value
      .split(symbols.pathDelim)
      .filter((pathPart) => !pathPart.match(validPathSegmentNameRegex))

    if (invalidPathPartNames.length) {
      return left(
        createInvalidPattern(
          pattern,
          `Path segment names must only contain ${String(validPathSegmentNameRegex)}.`
        )
      )
    }
  } else if (path.value === '' && !path.descendents) {
    return left(createInvalidPattern(pattern, `Must pass a path (e.g. "foo") or descendent matcher ("*")`))
  }

  return right({
    negate,
    path,
    originalInput: pattern,
    level,
  })
}

/**
 * Test if a log matches the pattern.
 */
export function test(patterns: Readonly<Parsed[]>, log: Logger.LogRecord): boolean {
  let yaynay = false
  for (const pattern of patterns) {
    // if log already passed then we can skip rest except negations
    if (yaynay && !pattern.negate) continue

    const logPath = log.path.join(symbols.pathDelim)
    let isPass = false

    // test in order of computational cost, short-citcuiting ASAP

    // level

    if (pattern.level.value === '*') {
      isPass = true
    } else {
      isPass = comp(pattern.level.comp, log.level, Level.LEVELS[pattern.level.value].number)
    }

    // path

    if (isPass) {
      if (pattern.path.descendents) {
        if (logPath === pattern.path.value) {
          isPass = pattern.path.descendents.includeParent
        } else {
          isPass = logPath.startsWith(pattern.path.value)
        }
      } else {
        isPass = pattern.path.value === logPath
      }
    }

    // Allow negates to undo previous passes while non-negates can only pass,
    // not unpass.
    if (pattern.negate) {
      yaynay = !isPass
    } else if (isPass) {
      yaynay = true
    }
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
  const renHint = `${hint ? ` Hint: ${hint}` : ''}`
  return createContextualError(`Invalid filter pattern: "${pattern}".${renHint}`, { pattern })
}

/**
 * Get the string contents of a manual showing how to write filters.
 */
export function renderSyntaxManual() {
  return `Log Filtering Syntax Manual
===========================

Grammar:

    [!](<path>|*)[@((<levelNum>|<levelLabel>)[+-]|*)][,<...>]

    <path>       = ${validPathSegmentNameRegex}
    <levelNum>   = 1     | 2     | 3    | 4    | 5     | 6
    <levelLabel> = trace | debug | info | warn | error | fatal

Examples:

    Paths:
    app         app path at default level
    app:router  app router path at default level

    Wildcards Paths:
    *           all paths at default level
    app:*       descendent paths of app at defualt level
    app*        app path and its descendent paths at defualt level

    Negate:
    !app        all paths expect app at default level 

    Lists:
    app,nexus   app and nexus paths at default level

    Levels:
    *@info      all paths at info level
    *@error-    all paths at error level or lower
    *@debug+    all paths at debug level or higher
    *@3         all paths at info level
    *@4-        all paths at error level or lower
    *@2+        all paths at debug level or higher

    Wildcard Paths:
    *@*         all paths at all levels

    Mixed:
    app@*       app path at all levels
    app:*@2+    descendent paths of app at debug level or higher
    app*@2-     app & descendent paths of app at debug level or lower  
  `
}

export function renderSyntaxError(input: {
  errPatterns: Either<ParseError, Parsed>[]
  foundIn?: string
  some?: boolean
}): string {
  const multipleInputs = input.errPatterns.length > 1
  const multipleErrors = input.errPatterns.filter(isLeft).length > 1
  const foundIn = `${input.foundIn ? ` found in ${input.foundIn}` : ''}`
  let message

  if (!multipleInputs) {
    const pattern = getLeft(input.errPatterns[0])?.context.pattern
    message = `Your log filter's pattern${foundIn} was invalid: "${pattern}"\n\n${renderSyntaxManual()}`
  } else if (!multipleErrors) {
    const pattern = getLeft(input.errPatterns[0])?.context.pattern
    message = `One of the patterns in your log filter${foundIn} was invalid: "${pattern}"\n\n${renderSyntaxManual()}`
  } else {
    const patterns = input.errPatterns
      .filter(isLeft)
      .map((e) => `    ${e.left.context.pattern}`)
      .join('\n')
    message = `Some of the patterns in your log filter${foundIn} were invalid:\n\n${patterns}${renderSyntaxManual()}`
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
    console.log(message)
  } else {
    patterns = errPatterns.map(rightOrThrow)
  }

  return patterns
}
