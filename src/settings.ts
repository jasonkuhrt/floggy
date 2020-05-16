import { chalk } from './chalk'
import * as Filter from './filter'
import * as Level from './level'
import * as Output from './output'
import { casesHandled, isEmpty, omitUndefinedKeys, parseFromEnvironment } from './utils'

export type Manager = Data & {
  (newSettings: Input): void
}

/**
 * The normalized settings. Unlike settings input there are no shorthands here.
 * This data is read-only, it is not intended to be mutated directly.
 */
export type Data = Readonly<{
  filter: Readonly<{
    originalInput: string
    defaults: Filter.Defaults
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

export type Input = {
  output?: Output.Output
  filter?: {
    /**
     * Filter logs based on given criteria.
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
     * todo revise jsdoc, the concept of this has changed
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
    level?: Level.Name
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

/**
 * Process data setting input.
 */
export function processSettingInputData(
  data: NonNullable<Input['data']>,
  previous: null | Data['data']
): Data['data'] {
  if (!previous) {
    return {
      ...defaultSettingData(),
      ...omitUndefinedKeys(data),
    }
  }

  return {
    ...previous,
    ...omitUndefinedKeys(data ?? {}),
  }
}

function defaultSettingData(): Data['data'] {
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
export function processSettingInputPretty(
  pretty: Input['pretty'],
  previous: null | Data['pretty']
): Data['pretty'] {
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

export function create(opts?: Input) {
  const state: Data = {
    pretty: processSettingInputPretty(opts?.pretty, null),
    filter: isEmpty(opts?.filter) ? defaultFilterSetting() : processSettingInputFilter(opts!.filter!, null),
    output: opts?.output ?? process.stdout,
    data: processSettingInputData(opts?.data ?? {}, null),
  }

  const settings = ((newSettings: Input) => {
    if (newSettings.output) {
      // @ts-ignore
      settings.output = newSettings.output
    }

    if ('pretty' in newSettings) {
      // @ts-ignore
      settings.pretty = processSettingInputPretty(newSettings.pretty, settings.pretty)
      // Sync chalk
      // Assume true color support, not doing all that -> https://github.com/chalk/chalk#256-and-truecolor-color-support
      chalk.level = settings.pretty.color ? 3 : 0
    }

    if ('data' in newSettings) {
      // @ts-ignore
      settings.data = processSettingInputData(newSettings.data, settings.data)
    }

    if (!isEmpty(newSettings.filter)) {
      // @ts-ignore
      settings.filter = processSettingInputFilter(newSettings.filter!, settings.filter)
    }
  }) as Manager

  Object.assign(settings, state)

  return settings
}

export function processSettingInputFilter(
  newSettingsFilter: NonNullable<Input['filter']>,
  prev: null | Data['filter']
): Data['filter'] {
  if (!prev) prev = defaultFilterSetting()
  const pattern = newSettingsFilter.pattern ?? prev.originalInput
  const criteriaDefaults = newSettingsFilter?.level
    ? ({ level: { value: newSettingsFilter.level, comp: 'gte' } } as const)
    : prev.defaults
  return {
    defaults: criteriaDefaults,
    originalInput: pattern,
    patterns: Filter.parse(criteriaDefaults, pattern),
  }
}

export function defaultFilterSetting(): Data['filter'] {
  let level: Level.Name
  if (process.env.LOG_LEVEL) {
    level = parseFromEnvironment<Level.Name>('LOG_LEVEL', Level.parser)
  } else {
    level = process.env.NODE_ENV === 'production' ? Level.LEVELS.info.label : Level.LEVELS.debug.label
  }
  let pattern: string
  if (process.env.LOG_FILTER) {
    pattern = process.env.LOG_FILTER
  } else {
    pattern = '*'
  }
  return {
    originalInput: pattern,
    defaults: { level: { value: level, comp: 'gte' } },
    patterns: Filter.parse({ level: { value: level, comp: 'gte' } }, pattern),
  }
}
