import { format } from 'util'
import { chalk } from './chalk'
import * as Filter from './filter'
import * as Level from './level'
import * as Logger from './logger'
import * as Output from './output'
import { casesHandled, omitUndefinedKeys } from './utils'

export const validPathSegmentNameRegex = /^[A-z_]+[A-z_0-9]*$/

/**
 * The normalized settings. Unlike settings input there are no shorthands here.
 * This data is read-only, it is not intended to be mutated directly.
 */
export type SettingsData = Readonly<{
  filter: Readonly<{
    originalInput: string
    criteriaDefaults: Filter.CriteriaDefaults
    patterns: Filter.Parsed[]
  }>
  pretty: Readonly<{
    enabled: boolean
    color: boolean
    levelLabel: boolean
    timeDiff: boolean
  }>
  data: {
    time: boolean
    pid: boolean
    hostname: boolean
  }
  output: Output.Output
}>

export type SettingsInput = {
  filter?: {
    /**
     * Filter logs based on given criteria.
     *
     * The level to filter by can be specified. If set, it overrides `filter.minLevel`.
     *
     * @default '*''
     *
     * @examples
     *
     * Logs from 'foo'
     *
     *    'foo'
     *
     * Logs from 'foo' _or_ 'bar'
     *
     *    'foo,bar'
     *
     * Logs from _not_ 'foo'
     *
     *    '!foo'
     *
     * Logs from 'foo' level 3 and up
     *
     *    'foo@3+'
     *
     * Logs at level 3 and up
     *
     *    '*@3+'
     *
     * Logs from 'foo' level 3 and down
     *
     *    'foo@3-'
     *
     * Logs from 'foo:sub'
     *
     *    'foo:sub'
     *
     * Logs from any descendents of 'foo:sub'
     *
     *    'foo:sub:*'
     *
     * Logs from any descendents of 'foo:sub' _and_ 'foo:sub' itself
     *
     *    'foo:sub*'
     *
     */
    pattern?: string
    /**
     * Set the minimum level a log must be at for it to be written to output.
     *
     * This level setting has highest precedence of all logger level configuration
     * tiers.
     *
     * @default
     *
     * Takes the first value found, searching in the following order:
     *
     *  1. LOG_LEVEL envar if set
     *  2. 'info' if NODE_ENV envar set to 'production'
     *  3. 'debug'
     */
    minLevel?: Level.Name
  }
  /**
   * Control pretty mode.
   *
   * Shorthands:
   *
   *  - `true` is shorthand for `{ enabled: true }`
   *  - `false` is shorthand for `{ enabled: false }`
   *
   * When `undefined` pretty takes the first value found, in order:
   *
   *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
   *  2. `process.stdout.isTTY`
   */
  pretty?:
    | boolean
    | {
        /**
         * Disable or enable pretty mode.
         *
         * When `undefined` pretty takes the first value found, in order:
         *
         *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
         *  2. `process.stdout.isTTY`
         */
        enabled?: boolean
        /**
         * Should logs be colored?
         *
         * @default `true`
         *
         * Disabling can be useful when pretty logs are going to a destination that
         * does not support rendering ANSI color codes (consequence being very
         * difficult to read content).
         */
        color?: boolean
        /**
         * Should logs include the level label?
         *
         * @default `false`
         *
         * Enable this if understanding the level of a log is important to you
         * and the icon+color system is insufficient for you to do so. Can be
         * helpful for newcomers or a matter of taste for some.
         */
        levelLabel?: boolean
        /**
         * Should the logs include the time between it and previous log?
         *
         * @default `true`
         */
        timeDiff?: boolean
      }
  /**
   * Toggle pieces of data that should or should not be logged.
   */
  data?: {
    /**
     * The Unix timestamp in milliseconds when the log was written to the
     * output.
     *
     * @defualt `true` if NODE_ENV="production"
     */
    time?: boolean
    /**
     * The current node process ID assigned by the operating system. Acquired
     * via `process.pid`.
     *
     * @defualt `true` if NODE_ENV="production"
     */
    pid?: boolean
    /**
     * The host name of the machine this process is running on. Acquired via `OS.hostname()`.
     *
     * @defualt `true` if NODE_ENV="production"
     */
    hostname?: boolean
  }
}

type Settings = SettingsData & {
  (newSettings: SettingsInput): RootLogger
}

// TODO jsDoc for each option
export type Options = SettingsInput & {
  output?: Output.Output
  name?: string
}

export type RootLogger = Logger.Logger & {
  settings: Settings
}

export type State = {
  settings: Settings
}

function processFilterSettingInput(filter: SettingsInput['filter']) {}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  let level = opts?.filter?.minLevel
  if (level === undefined) {
    if (process.env.LOG_LEVEL) {
      level = parseFromEnvironment<Level.Name>('LOG_LEVEL', Level.parser)
    } else {
      level = process.env.NODE_ENV === 'production' ? Level.LEVELS.info.label : Level.LEVELS.debug.label
    }
  }

  let filter: SettingsData['filter'] = {
    originalInput: '*',
    criteriaDefaults: { level: { value: level, comp: 'gte' } },
    patterns: Filter.parse({ level: { value: level, comp: 'gte' } }, opts?.filter?.pattern ?? '*'),
  }

  const settings = ((newSettings: SettingsInput) => {
    if ('pretty' in newSettings) {
      // @ts-ignore
      logger.settings.pretty = processSettingInputPretty(newSettings.pretty, logger.settings.pretty)
      // Sync chalk
      // Assume true color support, not doing all that -> https://github.com/chalk/chalk#256-and-truecolor-color-support
      chalk.level = logger.settings.pretty.color ? 3 : 0
    }

    if ('data' in newSettings) {
      // @ts-ignore
      logger.settings.data = processSettingInputData(newSettings.data, logger.settings.data)
    }

    if ('filter' in newSettings) {
      const pattern = newSettings.filter?.pattern ?? logger.settings.filter.originalInput
      const criteriaDefaults = newSettings.filter?.minLevel
        ? ({ level: { value: newSettings.filter?.minLevel, comp: 'gte' } } as const)
        : logger.settings.filter.criteriaDefaults
      // @ts-ignore
      logger.settings.filter = {
        criteriaDefaults,
        originalInput: pattern,
        patterns: Filter.parse(criteriaDefaults, pattern),
      }
    }

    return logger
  }) as Settings

  const state = { settings } as State
  const loggerLink = Logger.create(state, [opts?.name ?? 'root'], {})
  const logger = loggerLink.logger as RootLogger
  logger.settings = settings

  Object.assign(state.settings, {
    pretty: processSettingInputPretty(opts?.pretty, null),
    filter,
    output: opts?.output ?? process.stdout,
    data: processSettingInputData(opts?.data, null),
  })

  return logger
}

/**
 * Run a given parser over an environment variable. If parsing fails, throw a
 * contextual error message.
 */
function parseFromEnvironment<T>(
  key: string,
  parser: {
    info: { valid: string; typeName: string }
    run: (raw: string) => null | T
  }
): T {
  const envVarValue = process.env[key]! // assumes env presence handled before
  const result = parser.run(envVarValue)

  if (result === null) {
    throw new Error(
      `Could not parse environment variable ${key} into ${
        parser.info.typeName
      }. The environment variable was: ${format(envVarValue)}. A valid environment variable must be like: ${
        parser.info.valid
      }`
    )
  }

  return result
}

/**
 * Process data setting input.
 */
function processSettingInputData(
  data: SettingsInput['data'],
  previous: null | SettingsData['data']
): SettingsData['data'] {
  if (!previous) {
    return {
      ...getDefaultSettingDataValue(),
      ...omitUndefinedKeys(data ?? {}),
    }
  }

  return {
    ...previous,
    ...omitUndefinedKeys(data ?? {}),
  }
}

function getDefaultSettingDataValue(): SettingsData['data'] {
  if (process.env.NODE_ENV === 'production') {
    return {
      hostname: true,
      pid: true,
      time: true,
    }
  } else {
    return {
      hostname: false,
      pid: false,
      time: false,
    }
  }
}

/**
 * Process pretty setting input.
 */
function processSettingInputPretty(
  pretty: SettingsInput['pretty'],
  previous: null | SettingsData['pretty']
): SettingsData['pretty'] {
  // todo no semantic to "unset back to default"
  // consider using `null` for that purpose...
  const color = (typeof pretty === 'object' ? pretty.color : undefined) ?? previous?.color ?? true

  const enabled =
    (typeof pretty === 'object' ? pretty.enabled : undefined) ??
    previous?.enabled ??
    // todo nice is-defined-but-parse-error feedback
    (process.env.LOG_PRETTY?.toLowerCase() === 'true'
      ? true
      : process.env.LOG_PRETTY?.toLowerCase() === 'false'
      ? false
      : process.stdout.isTTY)

  const levelLabel =
    (typeof pretty === 'object' ? pretty.levelLabel : undefined) ?? previous?.levelLabel ?? false

  const timeDiff = (typeof pretty === 'object' ? pretty.timeDiff : undefined) ?? previous?.timeDiff ?? true

  if (pretty === undefined) {
    return { enabled, color, levelLabel, timeDiff }
  }

  if (pretty === true) {
    return { enabled: true, color, levelLabel, timeDiff }
  }

  if (pretty === false) {
    return { enabled: false, color, levelLabel, timeDiff }
  }

  if (typeof pretty === 'object') {
    return { enabled, color, levelLabel, timeDiff }
  }

  casesHandled(pretty)
}
