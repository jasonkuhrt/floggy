import * as Logger from './logger.js'
import * as Settings from './settings.js'

export type SettingsManager = Settings.Data & {
  (newSettings: Settings.Input): RootLogger
}

// TODO jsDoc for each option
export type Options = Settings.Input

export type RootLogger = Logger.Logger & {
  settings: SettingsManager
}

export type State = {
  settings: SettingsManager
}

/**
 * Create a root logger.
 */
export const create = (opts?: Options): RootLogger => {
  const settings = Settings.create(opts)
  const settingsManager = ((newSettings) => {
    settings(newSettings)
    Object.assign(settingsManager, settings)
    return logger
  }) as SettingsManager
  Object.assign(settingsManager, settings)
  const loggerLink = Logger.create({ settings: settingsManager }, null, undefined)
  const logger = loggerLink.logger as RootLogger
  logger.settings = settingsManager
  return logger
}
