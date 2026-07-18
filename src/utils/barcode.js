import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { TEXTBOX_FONT_FAMILIES, TEXTBOX_FONT_WEIGHTS } from './textboxFonts.js'

const cache = new Map()

/** @typedef {'EAN8' | 'EAN13' | 'CODE128' | 'QR'} BarcodeFormat */

export const BARCODE_INVALID_MESSAGE = 'Invalid barcode'

const EAN13_SIDE_MODULES = 3
const EAN13_MIDDLE_MODULES = 5
const EAN13_LEFT_DIGIT_MODULES = 6 * 7

const FREEFORM_FORMATS = new Set(['CODE128', 'QR'])

/** JsBarcode `font` / `fontOptions` for the human-readable EAN digits. */
export function barcodeTextFontOptions(serverFamily) {
  const family = serverFamily ?? `"${TEXTBOX_FONT_FAMILIES.outfit}"`
  return {
    font: family,
    fontOptions: String(TEXTBOX_FONT_WEIGHTS.outfit),
  }
}

export function getBarcodeValidationError(code, message = BARCODE_INVALID_MESSAGE, format) {
  const trimmed = String(code ?? '').trim()
  if (!trimmed) return null
  // Code 128 / QR accept free text; EAN formats are digits only.
  if (FREEFORM_FORMATS.has(format)) return null
  if (/\D/.test(trimmed)) return message
  return null
}

export function detectBarcodeFormat(code) {
  const digits = code.replace(/\D/g, '')
  return digits.length <= 8 ? 'EAN8' : 'EAN13'
}

export function resolveBarcodeFormat(obj) {
  if (
    obj.format === 'EAN8' ||
    obj.format === 'EAN13' ||
    obj.format === 'CODE128' ||
    obj.format === 'QR'
  ) {
    return obj.format
  }
  return detectBarcodeFormat(obj.code)
}

/** EAN-13 check digit for the first 12 digits (same formula JsBarcode uses). */
export function ean13Checksum(digits12) {
  const sum = digits12
    .slice(0, 12)
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}

export function normalizeBarcodeCode(code, format) {
  if (FREEFORM_FORMATS.has(format)) return String(code ?? '').trim()
  const digits = code.replace(/\D/g, '')
  if (format === 'EAN8') {
    return digits.length >= 8 ? digits.slice(0, 8) : digits.padStart(7, '0').slice(-7)
  }
  // Always include the check digit so the caption matches the encoded bars.
  if (digits.length >= 13) return digits.slice(0, 13)
  const body = digits.padStart(12, '0').slice(-12)
  return body + ean13Checksum(body)
}

function barcodeFontSize(obj) {
  return Math.max(10, Math.round(obj.scale * 7))
}

function barcodeCacheKey(obj, invalidMessage) {
  const format = resolveBarcodeFormat(obj)
  return `${format}|${obj.code}|${obj.scale}|${obj.h}|${invalidMessage}`
}

function drawInvalid(canvas, message = BARCODE_INVALID_MESSAGE) {
  canvas.width = 140
  canvas.height = 48
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fee2e2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#fca5a5'
  ctx.strokeRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#991b1b'
  ctx.font = '11px sans-serif'
  ctx.fillText(message, 8, 28)
  return { canvas, width: canvas.width, height: canvas.height }
}

/**
 * EAN-13 normally paints the first digit to the left of the bars. We keep the
 * guarded bar layout (tall start/middle/end markers) and draw all 13 digits
 * under the left/right halves instead.
 *
 * JsBarcode calls ctx.save() before resizing the canvas, which leaves a stale
 * clip on node-canvas (and can block further drawing). Re-assigning width/height
 * clears that graphics state before we paint the caption.
 */
function drawEan13Caption(canvas, code, obj, textFontOptions, fontSize, textMargin) {
  const width = canvas.width
  const height = canvas.height
  const bars = canvas.getContext('2d').getImageData(0, 0, width, height)
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  ctx.putImageData(bars, 0, 0)

  const moduleWidth = obj.scale
  const leftCenter =
    (EAN13_SIDE_MODULES + EAN13_LEFT_DIGIT_MODULES / 2) * moduleWidth
  const rightCenter =
    (EAN13_SIDE_MODULES +
      EAN13_LEFT_DIGIT_MODULES +
      EAN13_MIDDLE_MODULES +
      EAN13_LEFT_DIGIT_MODULES / 2) *
    moduleWidth
  const y = obj.h + textMargin + fontSize

  const weight = textFontOptions.fontOptions ? `${textFontOptions.fontOptions} ` : ''
  ctx.fillStyle = '#000000'
  ctx.font = `${weight}${fontSize}px ${textFontOptions.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(code.slice(0, 7), leftCenter, y)
  ctx.fillText(code.slice(7), rightCenter, y)
}

function paintQrOnCanvas(canvas, code, moduleWidth) {
  const qr = QRCode.create(code, { errorCorrectionLevel: 'M' })
  const modules = qr.modules.size
  const dim = Math.max(1, modules * Math.max(1, Math.round(moduleWidth)))
  const cell = dim / modules
  canvas.width = dim
  canvas.height = dim
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dim, dim)
  ctx.fillStyle = '#000000'
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!qr.modules.get(row, col)) continue
      ctx.fillRect(Math.floor(col * cell), Math.floor(row * cell), Math.ceil(cell), Math.ceil(cell))
    }
  }
  return { canvas, width: dim, height: dim }
}

/**
 * Paint a barcode onto an existing canvas (browser or node-canvas).
 * @returns {{ canvas: *, width: number, height: number } | null}
 */
export function paintBarcodeOnCanvas(canvas, obj, {
  invalidMessage = BARCODE_INVALID_MESSAGE,
  textFontOptions = barcodeTextFontOptions(),
  onInvalid = 'draw',
} = {}) {
  const format = resolveBarcodeFormat(obj)
  const validationError = getBarcodeValidationError(obj.code, invalidMessage, format)

  if (validationError) {
    if (onInvalid === 'skip') return null
    return drawInvalid(canvas, validationError)
  }

  const code = normalizeBarcodeCode(obj.code, format)

  if (format === 'QR') {
    try {
      return paintQrOnCanvas(canvas, code, obj.scale)
    } catch {
      if (onInvalid === 'skip') return null
      return drawInvalid(canvas, invalidMessage)
    }
  }

  const fontSize = barcodeFontSize(obj)
  const textMargin = 2
  // EAN-13: hide built-in text (first digit is drawn left of the bars) and
  // reserve bottom space so we can place all digits under the guarded layout.
  const customEan13Text = format === 'EAN13'

  try {
    JsBarcode(canvas, code, {
      format,
      width: obj.scale,
      height: obj.h,
      displayValue: !customEan13Text,
      ...textFontOptions,
      fontSize,
      margin: 0,
      // Guard bars already extend by ~fontSize/2; this makes room for the caption.
      marginBottom: customEan13Text ? Math.ceil(fontSize / 2) : 0,
      background: '#ffffff',
      lineColor: '#000000',
      textMargin,
    })
  } catch {
    if (onInvalid === 'skip') return null
    return drawInvalid(canvas, invalidMessage)
  }

  if (customEan13Text) {
    drawEan13Caption(canvas, code, obj, textFontOptions, fontSize, textMargin)
  }

  return { canvas, width: canvas.width, height: canvas.height }
}

export function renderBarcode(obj, invalidMessage = BARCODE_INVALID_MESSAGE) {
  const key = barcodeCacheKey(obj, invalidMessage)
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  const result = paintBarcodeOnCanvas(canvas, obj, { invalidMessage })
  cache.set(key, result)
  return result
}

export function getBarcodeSize(obj) {
  return renderBarcode(obj)
}

export function clearBarcodeCache() {
  cache.clear()
}
