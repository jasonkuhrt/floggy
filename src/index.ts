export { demo } from './demo'
export { Logger } from './logger'
export { RootLogger } from './root-logger'
export { Data as SettingsData, Input as SettingsInput } from './settings'

import { create } from './root-logger'

export const log = create()
