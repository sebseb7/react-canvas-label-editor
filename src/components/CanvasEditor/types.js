import { DEFAULT_TEXTBOX_FONT } from '../../utils/textboxFonts'
import { createId } from '../../utils/createId'

/**
 * @typedef {object} TextboxObject
 * @property {string} id
 * @property {'textbox'} type
 * @property {string} text
 * @property {'raster7x9' | 'outfit-light' | 'outfit' | 'outfit-bold' | 'outfit-black' | 'barlow-semi-condensed'} [font]
 * @property {number} [blackpoint] Luminance threshold (0–255) for TTF 1-bit conversion
 * @property {number} [minFontSize] Auto-fit bounds for TTF fonts only
 * @property {number} [maxFontSize] Auto-fit bounds for TTF fonts only
 * @property {'left' | 'center' | 'right'} [halign]
 * @property {'top' | 'middle' | 'bottom'} [valign]
 * @property {boolean} [invert] White text on black background
 * @property {number} [cornerRadius] Rounded corners when inverted (px)
 * @property {number} [rotation] Rotation in degrees (0 / 90 / 180 / 270)
 * @property {number} [marginLeft] Inner padding from left edge (px)
 * @property {number} [marginTop] Inner padding from top edge (px)
 * @property {number} [marginRight] Inner padding from right edge (px)
 * @property {number} [marginBottom] Inner padding from bottom edge (px)
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * @typedef {object} BarcodeObject
 * @property {string} id
 * @property {'barcode'} type
 * @property {number} x
 * @property {number} y
 * @property {number} h
 * @property {number} scale Module width (integer bar width in px)
 * @property {string} code
 * @property {'EAN8' | 'EAN13'} [format] Barcode symbology; auto-detected from code length if omitted
 */

/**
 * @typedef {object} PngObject
 * @property {string} id
 * @property {'png'} type
 * @property {number} x
 * @property {number} y
 * @property {number} scale Fractional scale factor
 * @property {string} src Inline image: raw SVG, or data URL (PNG/JPEG base64)
 * @property {number} blackpoint Luminance threshold (0–255) for 1-bit conversion
 */

/** @typedef {TextboxObject | BarcodeObject | PngObject} EditorObject */

export function createTextbox(overrides = {}) {
  return {
    id: createId(),
    type: 'textbox',
    text: 'Sample text',
    font: DEFAULT_TEXTBOX_FONT,
    blackpoint: 128,
    minFontSize: 14,
    maxFontSize: 36,
    halign: 'left',
    valign: 'top',
    invert: false,
    cornerRadius: 0,
    rotation: 0,
    marginLeft: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    x: 40,
    y: 40,
    w: 200,
    h: 80,
    ...overrides,
  }
}

export function createBarcode(overrides = {}) {
  return {
    id: createId(),
    type: 'barcode',
    x: 40,
    y: 160,
    h: 60,
    scale: 2,
    format: 'EAN13',
    code: '4006381333931',
    ...overrides,
  }
}

export function createPng(overrides = {}) {
  return {
    id: createId(),
    type: 'png',
    x: 280,
    y: 40,
    scale: 1,
    src: '',
    blackpoint: 128,
    ...overrides,
  }
}
