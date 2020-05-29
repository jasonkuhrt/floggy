import * as Lo from 'lodash'
import * as OS from 'os'
import { validPathSegmentNameRegex } from './data'
import * as Filter from './filter'
import { LEVELS, Name, Num } from './level'
import * as Prettifier from './prettifier'
import * as RootLogger from './root-logger'

type Context = Record<string, unknown>

export type LogRecord = {
  level: Num
  event: string
  path?: string[]
  context?: Context
  time?: number
  pid?: number
  hostname?: string
}

export type LogHandler = (logRecord: LogRecord) => void

type Log = (event: string, context?: Context) => void

export type Logger = {
  fatal: Log
  error: Log
  warn: Log
  info: Log
  debug: Log
  trace: Log
  addToContext: (context: Context) => Logger // fluent
  child: (name: string) => Logger // fluent
}

/**
 * Create a logger.
 */
export function create(
  rootState: RootLogger.State,
  path: null | string[],
  parentContext?: Context
): { logger: Logger; link: Link } {
  if (path) validatePath(path)
  const state: State = {
    // Copy as addToContext will mutate it
    pinnedAndParentContext: parentContext ? Lo.cloneDeep(parentContext) : undefined,
    children: [],
  }

  function updateContextAndPropagate(newContext: Context) {
    state.pinnedAndParentContext = newContext
    state.children.forEach((child) => {
      child.onNewParentContext(state.pinnedAndParentContext!)
    })
  }

  function send(levelLabel: Name, event: string, localContext: undefined | Context, handler?: LogHandler) {
    const level = LEVELS[levelLabel].number
    const logRec: LogRecord = {
      event,
      level,
    }

    if (path) logRec.path = path

    if (Filter.test(rootState.settings.filter.patterns, logRec)) {
      // Avoid mutating the passed local context
      if (localContext && state.pinnedAndParentContext) {
        logRec.context = Lo.merge({}, state.pinnedAndParentContext, localContext)
      } else if (localContext) {
        logRec.context = localContext
      } else if (state.pinnedAndParentContext) {
        logRec.context = state.pinnedAndParentContext
      }

      if (rootState.settings?.data.hostname) {
        logRec.hostname = OS.hostname()
      }
      if (rootState.settings?.data.pid) {
        logRec.pid = process.pid
      }
      if (rootState.settings?.data.time) {
        logRec.time = Date.now()
      }
      const logMsg = rootState.settings.pretty.enabled
        ? Prettifier.render(rootState.settings.pretty, logRec)
        : JSON.stringify(logRec)
      rootState.settings.output.write(logMsg + OS.EOL)

      if (rootState.settings?.handler) {
        rootState.settings.handler(logRec)
      }
    }
  }

  const link: Link = {
    onNewParentContext(newParentContext: Context) {
      updateContextAndPropagate(
        Lo.merge(
          // Copy so that we don't mutate parent while maintaining local overrides...
          {},
          newParentContext,
          // ...this
          state.pinnedAndParentContext
        )
      )
    },
  }

  const logger: Logger = {
    fatal(event, context) {
      send('fatal', event, context)
    },
    error(event, context) {
      send('error', event, context)
    },
    warn(event, context) {
      send('warn', event, context)
    },
    info(event, context) {
      send('info', event, context)
    },
    debug(event, context) {
      send('debug', event, context)
    },
    trace(event, context) {
      send('trace', event, context)
    },
    addToContext(context: Context) {
      // Can safely mutate here, save some electricity...
      updateContextAndPropagate(Lo.merge(state.pinnedAndParentContext, context))
      return logger
    },
    child: (name: string): Logger => {
      const { logger: child, link } = create(
        rootState,
        path ? path.concat([name]) : [name],
        state.pinnedAndParentContext
      )
      state.children.push(link)
      return child
    },
  }

  return {
    logger,
    link,
  }
}

type Link = {
  onNewParentContext: (newContext: Context) => void
}

type State = {
  pinnedAndParentContext?: Context
  children: Link[]
}

function validatePath(path: string[]) {
  path.forEach((part) => {
    if (!validPathSegmentNameRegex.test(part)) {
      throw new Error(`Invalid logger path segment: ${part}`)
    }
  })
}
