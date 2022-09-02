import * as Execa from 'execa'
import * as Fs from 'node:fs'

const packageJson = JSON.parse(Fs.readFileSync('package.json', 'utf8')) as { type?: 'module' | 'commonjs' }
Fs.writeFileSync('package.json', JSON.stringify({ ...packageJson, type: 'module' }, null, 2))

Execa.commandSync('pnpm tsc --project tsconfig.esm.json', { stdio: 'inherit' })

Fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
