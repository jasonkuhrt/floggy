import { create } from './root-logger.js'

export { demo } from './demo.js'
export { Logger } from './logger.js'
export { Renderer } from './Renderer/index.js'
export { RootLogger } from './root-logger.js'
export { Data as SettingsData, Input as SettingsInput } from './settings.js'

export const log = create()
