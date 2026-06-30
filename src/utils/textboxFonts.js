/** @typedef {'raster7x9' | 'outfit' | 'barlow-semi-condensed'} TextboxFont */

export const TEXTBOX_FONTS = /** @type {const} */ ([
  'outfit',
  'barlow-semi-condensed',
  'raster7x9',
])

export const DEFAULT_TEXTBOX_FONT = 'outfit'

export const TEXTBOX_FONT_LABELS = {
  raster7x9: '7×9 Raster',
  outfit: 'Outfit Medium',
  'barlow-semi-condensed': 'Barlow Semi Condensed Medium',
}

export const TEXTBOX_FONT_FAMILIES = {
  outfit: 'Outfit',
  'barlow-semi-condensed': 'Barlow Semi Condensed',
}

export const TEXTBOX_FONT_WEIGHTS = {
  outfit: 500,
  'barlow-semi-condensed': 500,
}

export function canvasFontCss(size, family, weight = 400) {
  const name = family.includes(' ') ? `"${family}"` : family
  return `${weight} ${size}px ${name}`
}

export function isRasterTextboxFont(font) {
  return font === 'raster7x9'
}

export function isTtfTextboxFont(font) {
  return font === 'outfit' || font === 'barlow-semi-condensed'
}

export function resolveTextboxFont(font) {
  if (font === 'raster9x8') return 'raster7x9'
  if (TEXTBOX_FONTS.includes(font)) return font
  return DEFAULT_TEXTBOX_FONT
}

let fontsReady = null

export function ensureEditorFontsLoaded() {
  if (typeof document === 'undefined') return Promise.resolve()
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load("500 16px 'Outfit'"),
      document.fonts.load("500 16px 'Barlow Semi Condensed'"),
    ]).catch(() => undefined)
  }
  return fontsReady
}
