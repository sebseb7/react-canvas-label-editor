/** @typedef {'raster7x9' | 'outfit' | 'barlow-semi-condensed'} TextboxFont */

export const TEXTBOX_FONT_OPTIONS = /** @type {const} */ ([
  { id: 'outfit', label: 'Outfit Medium' },
  { id: 'barlow-semi-condensed', label: 'Barlow Semi Condensed Medium' },
  { id: 'raster7x9', label: '7×9 Raster' },
])

export const TEXTBOX_FONTS = TEXTBOX_FONT_OPTIONS.map((option) => option.id)

export const DEFAULT_TEXTBOX_FONT = 'outfit'

export const TEXTBOX_FONT_LABELS = Object.fromEntries(
  TEXTBOX_FONT_OPTIONS.map((option) => [option.id, option.label]),
)

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
