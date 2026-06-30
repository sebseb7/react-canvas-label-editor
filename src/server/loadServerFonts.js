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
  outfit: 'LabelOutfit',
  'barlow-semi-condensed': 'LabelBarlowSemiCondensed',
}

const FONT_FILES = {
  outfit: 'Outfit-Medium.ttf',
  'barlow-semi-condensed': 'BarlowSemiCondensed-Medium.ttf',
}

let registered = false

export function registerServerFonts() {
  if (registered) return
  registered = true

  // node-canvas/Pango renders WOFF as missing-glyph boxes; TTF is required.
  registerFont(path.join(fontsDir, FONT_FILES.outfit), {
    family: SERVER_FONT_FAMILIES.outfit,
    weight: '500',
  })
  registerFont(path.join(fontsDir, FONT_FILES['barlow-semi-condensed']), {
    family: SERVER_FONT_FAMILIES['barlow-semi-condensed'],
    weight: '500',
  })
}

export function serverFontFamily(fontId) {
  return SERVER_FONT_FAMILIES[fontId] ?? SERVER_FONT_FAMILIES.outfit
}
