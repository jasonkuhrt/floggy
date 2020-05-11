import * as Lo from 'lodash'
import * as OS from 'os'
import * as Filter from './filter'
import { LEVELS, Name, Num } from './level'
import * as Prettifier from './prettifier'
import * as RootLogger from './root-logger'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

export type LogRecord = {
  level: Num
  path: string[]
  event: string
  context: Context
  time?: number
  pid?: number
  hostname?: string
}

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
  path: string[],
  parentContext: Context
): { logger: Logger; link: Link } {
  const state: State = {
    // Copy as addToContext will mutate it
    pinnedAndParentContext: Lo.cloneDeep(parentContext),
    children: [],
  }

  function updateContextAndPropagate(newContext: Context) {
    state.pinnedAndParentContext = newContext
    state.children.forEach((child) => {
      child.onNewParentContext(state.pinnedAndParentContext)
    })
  }

  function send(levelLabel: Name, event: string, localContext: undefined | Context) {
    const level = LEVELS[levelLabel].number
    const logRec: LogRecord = {
      path,
      context: {}, // unused by filtering, be lazy to avoid merge cost
      event,
      level,
    }

    if (Filter.test(rootState.settings.filter.patterns, logRec)) {
      // Avoid mutating the passed local context
      const context = localContext
        ? Lo.merge({}, state.pinnedAndParentContext, localContext)
        : state.pinnedAndParentContext

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
      const { logger: child, link } = create(rootState, path.concat([name]), state.pinnedAndParentContext)
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
  pinnedAndParentContext: Context
  children: Link[]
}
