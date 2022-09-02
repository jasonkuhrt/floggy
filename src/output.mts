import { SettingsData } from './index.mjs'
import { LogRecord } from './logger.mjs'
import { Renderer } from './Renderer/index.mjs'
import * as Os from 'node:os'

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
