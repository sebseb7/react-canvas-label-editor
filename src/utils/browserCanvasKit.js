import CanvasKitInit from 'canvaskit-wasm'
import { SERVER_FONT_FAMILIES } from './textboxFonts.js'

const FONT_FILES = {
  'outfit-light': 'Outfit-Light.ttf',
  outfit: 'Outfit-Medium.ttf',
  'outfit-bold': 'Outfit-Bold.ttf',
  'outfit-black': 'Outfit-Black.ttf',
  'barlow-semi-condensed': 'BarlowSemiCondensed-Medium.ttf',
}

const FONT_WEIGHTS = {
  'outfit-light': '300',
  outfit: '500',
  'outfit-bold': '700',
  'outfit-black': '900',
  'barlow-semi-condensed': '500',
}

let browserCkPromise = null

async function fetchFontBytes(filename) {
  // Try candidate URLs: import.meta relative URL first, then root fonts
  const candidates = [
    new URL(`../fonts/${filename}`, import.meta.url).href,
    `/src/fonts/${filename}`,
    `/fonts/${filename}`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url)
      const ct = res.headers.get('content-type') || ''
      if (res.ok && !ct.includes('html')) {
        const buf = await res.arrayBuffer()
        if (buf.byteLength > 1000) {
          return buf
        }
      }
    } catch {
      // try next
    }
  }
  throw new Error(`Failed to load font file: ${filename}`)
}

export async function getBrowserCanvasKit(options = {}) {
  if (browserCkPromise) return browserCkPromise

  browserCkPromise = (async () => {
    let locateFile = options.locateFile
    if (!locateFile) {
      try {
        const testRes = await fetch('/canvaskit.wasm', { method: 'HEAD' })
        const ct = testRes.headers.get('content-type') || ''
        if (testRes.ok && ct.includes('wasm')) {
          locateFile = (file) => `/${file}`
        }
      } catch {
        // ignore
      }
      if (!locateFile) {
        locateFile = (file) => `https://unpkg.com/canvaskit-wasm@0.42.0/bin/${file}`
      }
    }

    const ck = await CanvasKitInit({ locateFile })

    const fontCanvas = ck.MakeCanvas(1, 1)

    for (const [key, filename] of Object.entries(FONT_FILES)) {
      const bytes = await fetchFontBytes(filename)
      const weight = FONT_WEIGHTS[key]
      const serverFam = SERVER_FONT_FAMILIES[key]
      fontCanvas.loadFont(bytes, { family: serverFam, weight })
      if (key.startsWith('outfit')) {
        fontCanvas.loadFont(bytes, { family: 'Outfit', weight })
        fontCanvas.loadFont(bytes, { family: 'sans-serif', weight })
      } else if (key === 'barlow-semi-condensed') {
        fontCanvas.loadFont(bytes, { family: 'Barlow Semi Condensed', weight })
      }
    }

    return { ck, fontCanvas }
  })()

  return browserCkPromise
}
