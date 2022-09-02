import { create } from './root-logger.mjs'

export { demo } from './demo.mjs'
export { Logger } from './logger.mjs'
export { Renderer } from './Renderer/index.mjs'
export { RootLogger } from './root-logger.mjs'
export { Data as SettingsData, Input as SettingsInput } from './settings.mjs'

export const log = create()
