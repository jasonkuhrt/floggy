export type Name = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export type Num = 6 | 5 | 4 | 3 | 2 | 1

export const LEVELS: Record<Name, { label: Name; number: Num }> = {
  fatal: {
    label: 'fatal',
    number: 6,
  },
  error: {
    label: 'error',
    number: 5,
  },
  warn: {
    label: 'warn',
    number: 4,
  },
  info: {
    label: 'info',
    number: 3,
  },
  debug: {
    label: 'debug',
    number: 2,
  },
  trace: {
    label: 'trace',
    number: 1,
  },
}

export const LEVELS_BY_NUM = Object.values(LEVELS).reduce(
  (lookup, entry) => Object.assign(lookup, { [entry.number]: entry }),
  {}
) as Record<Num, { label: Name; number: Num }>

/**
 * Parser for log level. The given value is treated case insensitive.
 */
export const parser = {
  info: {
    typeName: 'LogLevel',
    valid: Object.entries(LEVELS)
      .map(([label]) => label)
      .join(', '),
  },
  run: (raw: string) => {
    return (LEVELS as any)[raw.toLowerCase()]?.label ?? null
  },
}
