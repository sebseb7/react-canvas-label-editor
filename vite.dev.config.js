import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { renderApiPlugin } from './dev/viteRenderApi.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), renderApiPlugin()],
  resolve: {
    alias: {
      'react-canvas-label-editor': path.resolve(root, 'src/entry-client.js'),
    },
  },
})
