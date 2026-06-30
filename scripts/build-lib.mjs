import { cp, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { build } from 'vite'

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
