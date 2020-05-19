import * as Logger from './logger'
import * as Settings from './settings'

export type SettingsManager = Settings.Data & {
  (newSettings: Settings.Input): RootLogger
}

// TODO jsDoc for each option
export type Options = Settings.Input & {
  name?: string
}

export type RootLogger = Logger.Logger & {
  settings: SettingsManager
}

export type State = {
  settings: SettingsManager
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  const settings = Settings.create(opts)
  const settingsManager = ((newSettings) => {
    settings(newSettings)
    Object.assign(settingsManager, settings)
    return logger
  }) as SettingsManager
  Object.assign(settingsManager, settings)
  const loggerLink = Logger.create({ settings: settingsManager }, [opts?.name ?? 'root'], {})
  const logger = loggerLink.logger as RootLogger
  logger.settings = settingsManager
  return logger
}
