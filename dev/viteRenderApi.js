import { renderLabel } from '../src/server/renderLabel.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function attachRenderApi(middlewares) {
  middlewares.use(async (req, res, next) => {
    if (req.url !== '/api/render' || req.method !== 'POST') {
      next()
      return
    }

    try {
      const raw = await readBody(req)
      const body = JSON.parse(raw.toString('utf8'))
      const { height, width, objects } = body ?? {}

      if (!Array.isArray(objects)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Expected { height, objects }' }))
        return
      }

      const start = performance.now()
      const png = await renderLabel({
        height: Number(height) || 200,
        ...(width ? { width: Number(width) } : {}),
        objects,
      })
      const ms = Math.round(performance.now() - start)
      console.log(`[render-api] 1-bit PNG generated in ${ms}ms`)

      res.statusCode = 200
      res.setHeader('Content-Type', 'image/png')
      res.end(png)
    } catch (err) {
      console.error('[render-api]', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: err.message || 'Render failed' }))
    }
  })
}

export function renderApiPlugin() {
  return {
    name: 'render-api',
    configureServer(server) {
      attachRenderApi(server.middlewares)
    },
    configurePreviewServer(server) {
      attachRenderApi(server.middlewares)
    },
  }
}
