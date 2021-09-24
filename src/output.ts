import * as Os from 'os'
import { SettingsData } from '.'
import { LogRecord } from './logger'
import { Renderer } from './Renderer'

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
