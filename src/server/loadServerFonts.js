import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import CanvasKitInit from 'canvaskit-wasm'

function resolveFontsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (const dir of [path.join(here, 'fonts'), path.join(here, '..', 'fonts')]) {
    if (existsSync(path.join(dir, 'Outfit-Medium.ttf'))) return dir
  }
  throw new Error('Label editor font files not found')
}

/** Font family names used on the label rasterizer. */
export const SERVER_FONT_FAMILIES = {
  'outfit-light': 'LabelOutfitLight',
  outfit: 'LabelOutfit',
  'outfit-bold': 'LabelOutfitBold',
  'outfit-black': 'LabelOutfitBlack',
  'barlow-semi-condensed': 'LabelBarlowSemiCondensed',
}

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

let ckInstancePromise = null

export function registerServerFonts() {
  // Synchronous no-op kept for backwards compatibility.
  // getCanvasKit() initializes fonts asynchronously before rendering starts.
}

export function serverFontFamily(fontId) {
  return SERVER_FONT_FAMILIES[fontId] ?? SERVER_FONT_FAMILIES.outfit
}

export async function getCanvasKit() {
  if (ckInstancePromise) return ckInstancePromise

  ckInstancePromise = (async () => {
    const ck = await CanvasKitInit()
    const fontCanvas = ck.MakeCanvas(1, 1)
    const fontsDir = resolveFontsDir()

    for (const [key, filename] of Object.entries(FONT_FILES)) {
      const bytes = readFileSync(path.join(fontsDir, filename))
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

  return ckInstancePromise
}
