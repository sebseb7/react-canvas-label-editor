import { cp, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { build } from 'vite'

// Library builds must use the production JSX transform. If NODE_ENV is
// "development" (common when a consumer runs npm install), Vite inlines
// jsx-dev-runtime with require("react"), which crashes in the browser.
process.env.NODE_ENV = 'production'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const nodeEntry = `export * from './client.js'
export { renderLabel } from '../src/server/renderLabel.js'
`

await build({
  configFile: path.resolve(root, 'vite.config.js'),
})

await mkdir(path.resolve(root, 'dist/fonts'), { recursive: true })
await cp(path.resolve(root, 'src/fonts'), path.resolve(root, 'dist/fonts'), {
  recursive: true,
  filter: (src) => !src.endsWith('.css') && !src.endsWith('.js'),
})

await writeFile(path.resolve(root, 'dist/node.js'), nodeEntry)
await writeFile(path.resolve(root, 'dist/index.js'), nodeEntry)
