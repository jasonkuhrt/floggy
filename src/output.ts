import * as Os from 'node:os'
import { SettingsData } from './index.js'
import { LogRecord } from './logger.js'
import { Renderer } from './Renderer/index.js'

export type Output = {
  write: (record: LogRecord, settings: SettingsData) => void
}

export const defaultOutput: SettingsData['output'] = {
  write: (record, settings) => {
    process.stdout.write(
      settings.pretty.enabled ? Renderer.render(settings.pretty, record) : JSON.stringify(record) + Os.EOL
    )
  }
}
