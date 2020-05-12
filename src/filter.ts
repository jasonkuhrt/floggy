import * as Level from './level'
import * as Logger from './logger'
import { validPathSegmentNameRegex } from './root-logger'
import { casesHandled, last } from './utils'

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
 * Parse a full pattern. This accounts for lists of patterns. This the parsing entrypoint.
 */
export function parse(criteriaDefaults: Defaults, pattern: string): Parsed[] {
  // Allow sloppy lists so long as there is at least one pattern given
  const patterns = pattern
    .split(symbols.patternDelim)
    .map((p) => p.trim())
    .filter((p) => p !== '')

  if (!patterns.length) {
    throw createInvalidPattern(pattern, 'There must be at least one pattern present.')
  }

  return patterns.map((p) => parseOne(criteriaDefaults, p))
}

function createInvalidPattern(pattern: string, hint?: string): SyntaxError {
  return new SyntaxError(
    `Invalid filter pattern: "${pattern}".${hint ? ` Hint: ${hint}` : ''}

Syntax:

  (<path>|*)[@((<levelNum>|<levelLabel>)[+-]|*)][,<...>]

  <path>       = ${validPathSegmentNameRegex}
  <levelNum>   = 1     | 2     | 3    | 4    | 5     | 6
  <levelLabel> = trace | debug | info | warn | error | fatal

Examples:

    *           all paths at default level
    *@*         all paths at all levels
    *@info      all paths at info level
    *@3         all paths at info level
    *@3+        all paths at info level or higher
    *@3-        all paths at info level or lower
    app@*       app path at all levels
    app:foo     app:foo path at default level
    app,nexus   app and nexus paths at default level
    app:*       descendent paths of app at defualt level
    app:*@2+    descendent paths of app at debug level or higher
    app*@2+     app & descendent paths of app at debug level or higher
`
  )
}

/**
 * Parse a single pattern. This assumes parsing of "," has already been handled
 * including whitespace trimming around the pattern.
 */
export function parseOne(criteriaDefaults: Defaults, pattern: string): Parsed {
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
      throw createInvalidPattern(pattern)
    }
  }

  // check for errors

  if (path.value !== '') {
    const invalidPathPartNames = path.value
      .split(symbols.pathDelim)
      .filter((pathPart) => !pathPart.match(validPathSegmentNameRegex))

    if (invalidPathPartNames.length) {
      throw createInvalidPattern(
        pattern,
        `Path segment names must only contain ${String(validPathSegmentNameRegex)}.`
      )
    }
  } else if (path.value === '' && !path.descendents) {
    throw createInvalidPattern(pattern, `Must pass a path (e.g. "foo") or descendent matcher ("*")`)
  }

  return {
    negate,
    path,
    originalInput: pattern,
    level,
  }
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
