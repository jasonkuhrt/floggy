import { execaCommandSync } from 'execa'
import * as Glob from 'fast-glob'
import * as Fs from 'fs-jetpack'

console.log(process.argv)

type Mode = 'cjs' | 'esm'

const oppositeMode = {
  esm: `cjs`,
  cjs: `esm`
} as const

const extensions = {
  cjs: { node: `cjs`, ts: `cts` },
  esm: { node: `mjs`, ts: `mts` }
} as const

const changeImportFilePathMode = (mode: Mode, string: string) =>
  string.replace(new RegExp(`\\.${extensions[oppositeMode[mode]].node}'$`, `g`), `.${extensions[mode].node}'`)

const changeFilePathMode = (mode: Mode, string: string) =>
  string.replace(new RegExp(`\\.${extensions[oppositeMode[mode]].ts}$`, `g`), `.${extensions[mode].ts}`)

execaCommandSync(`pnpm tsc --project tsconfig.esm.json`, { stdio: `inherit` })

const mode: Mode = `cjs`

const files = Glob.sync(`src/**/*.${extensions[oppositeMode[mode]].ts}`)

if (files.length === 0) {
  console.log(`No files found.`)
  process.exit(1)
}

files.forEach((oldFilePath) => {
  const newFilePath = changeFilePathMode(mode, oldFilePath)
  Fs.rename(oldFilePath, newFilePath)
  // filePath comes from glob so we know it exists
  // eslint-disable-next-line
  const oldFileContents = Fs.read(newFilePath)!
  const newFileContents = changeImportFilePathMode(mode, oldFileContents)
  Fs.write(newFilePath, newFileContents)
})

execaCommandSync(`pnpm tsc --project tsconfig.${mode}.json`, { stdio: `inherit` })

files.forEach((oldFilePath) => {
  const newFilePath = changeFilePathMode(mode, oldFilePath)
  Fs.rename(newFilePath, oldFilePath)
  // filePath comes from glob so we know it exists
  // eslint-disable-next-line
  const newFileContents = Fs.read(oldFilePath)!
  const oldFileContents = changeImportFilePathMode(oppositeMode[mode], newFileContents)
  Fs.write(oldFilePath, oldFileContents)
})
