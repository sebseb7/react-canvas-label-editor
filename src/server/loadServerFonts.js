import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerFont } from 'canvas'

function resolveFontsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (const dir of [path.join(here, 'fonts'), path.join(here, '..', 'fonts')]) {
    if (existsSync(path.join(dir, 'Outfit-Medium.ttf'))) return dir
  }
  throw new Error('Label editor font files not found')
}

const fontsDir = resolveFontsDir()

/** Pango family names used only on the server label rasterizer. */
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

let registered = false

export function registerServerFonts() {
  if (registered) return
  registered = true

  // node-canvas/Pango renders WOFF as missing-glyph boxes; TTF is required.
  // Each weight is registered under its own family name because Pango's
  // weight matching across faces of one family is unreliable.
  for (const font of Object.keys(SERVER_FONT_FAMILIES)) {
    registerFont(path.join(fontsDir, FONT_FILES[font]), {
      family: SERVER_FONT_FAMILIES[font],
      weight: FONT_WEIGHTS[font],
    })
  }
}

export function serverFontFamily(fontId) {
  return SERVER_FONT_FAMILIES[fontId] ?? SERVER_FONT_FAMILIES.outfit
}
