/** @typedef {'raster7x9' | 'outfit-light' | 'outfit' | 'outfit-bold' | 'outfit-black' | 'barlow-semi-condensed'} TextboxFont */

export const TEXTBOX_FONT_OPTIONS = /** @type {const} */ ([
  { id: 'outfit-light', label: 'Outfit Light' },
  { id: 'outfit', label: 'Outfit Medium' },
  { id: 'outfit-bold', label: 'Outfit Bold' },
  { id: 'outfit-black', label: 'Outfit Black' },
  { id: 'barlow-semi-condensed', label: 'Barlow Semi Condensed Medium' },
  { id: 'raster7x9', label: '7×9 Raster' },
])

export const TEXTBOX_FONTS = TEXTBOX_FONT_OPTIONS.map((option) => option.id)

export const DEFAULT_TEXTBOX_FONT = 'outfit'

export const TEXTBOX_FONT_LABELS = Object.fromEntries(
  TEXTBOX_FONT_OPTIONS.map((option) => [option.id, option.label]),
)

export const TEXTBOX_FONT_FAMILIES = {
  'outfit-light': 'Outfit',
  outfit: 'Outfit',
  'outfit-bold': 'Outfit',
  'outfit-black': 'Outfit',
  'barlow-semi-condensed': 'Barlow Semi Condensed',
}

export const TEXTBOX_FONT_WEIGHTS = {
  'outfit-light': 300,
  outfit: 500,
  'outfit-bold': 700,
  'outfit-black': 900,
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
  return font !== 'raster7x9' && TEXTBOX_FONTS.includes(font)
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
      document.fonts.load("300 16px 'Outfit'"),
      document.fonts.load("500 16px 'Outfit'"),
      document.fonts.load("700 16px 'Outfit'"),
      document.fonts.load("900 16px 'Outfit'"),
      document.fonts.load("500 16px 'Barlow Semi Condensed'"),
    ]).catch(() => undefined)
  }
  return fontsReady
}
