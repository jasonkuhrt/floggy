import * as Lo from 'lodash'
import * as OS from 'os'
import { Level, LevelNum, LEVELS } from './level'
import * as Prettifier from './prettifier'
import * as RootLogger from './root-logger'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

export type LogRecord = {
  level: LevelNum
  path: string[]
  event: string
  context: Context
  time: number
  pid: number
  hostname: string
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

  function send(level: Level, event: string, localContext: undefined | Context) {
    const thisLevel = LEVELS[level].number
    const levelSetting = LEVELS[rootState.settings.level].number
    if (thisLevel >= levelSetting) {
      // Avoid mutating the passed local context
      const context = localContext
        ? Lo.merge({}, state.pinnedAndParentContext, localContext)
        : state.pinnedAndParentContext
      const logRec: LogRecord = {
        path,
        context,
        event,
        level: thisLevel,
        time: Date.now(),
        hostname: OS.hostname(),
        pid: process.pid,
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
