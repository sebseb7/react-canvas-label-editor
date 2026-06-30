import JsBarcode from 'jsbarcode'
import { TEXTBOX_FONT_FAMILIES, TEXTBOX_FONT_WEIGHTS } from './textboxFonts.js'

const cache = new Map()

/** @typedef {'EAN8' | 'EAN13'} BarcodeFormat */

export const BARCODE_INVALID_MESSAGE = 'Ungültiger Barcode'

/** JsBarcode `font` / `fontOptions` for the human-readable EAN digits. */
export function barcodeTextFontOptions(serverFamily) {
  const family = serverFamily ?? `"${TEXTBOX_FONT_FAMILIES.outfit}"`
  return {
    font: family,
    fontOptions: String(TEXTBOX_FONT_WEIGHTS.outfit),
  }
}

export function getBarcodeValidationError(code) {
  const trimmed = String(code ?? '').trim()
  if (!trimmed) return null
  if (/\D/.test(trimmed)) return BARCODE_INVALID_MESSAGE
  return null
}

export function detectBarcodeFormat(code) {
  const digits = code.replace(/\D/g, '')
  return digits.length <= 8 ? 'EAN8' : 'EAN13'
}

export function resolveBarcodeFormat(obj) {
  if (obj.format === 'EAN8' || obj.format === 'EAN13') return obj.format
  return detectBarcodeFormat(obj.code)
}

export function normalizeBarcodeCode(code, format) {
  const digits = code.replace(/\D/g, '')
  if (format === 'EAN8') {
    return digits.length >= 8 ? digits.slice(0, 8) : digits.padStart(7, '0').slice(-7)
  }
  return digits.length >= 13 ? digits.slice(0, 13) : digits.padStart(12, '0').slice(-12)
}

function barcodeCacheKey(obj) {
  const format = resolveBarcodeFormat(obj)
  return `${format}|${obj.code}|${obj.scale}|${obj.h}`
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

export function renderBarcode(obj) {
  const key = barcodeCacheKey(obj)
  const cached = cache.get(key)
  if (cached) return cached

  const format = resolveBarcodeFormat(obj)
  const validationError = getBarcodeValidationError(obj.code)
  const canvas = document.createElement('canvas')

  if (validationError) {
    const result = drawInvalid(canvas, validationError)
    cache.set(key, result)
    return result
  }

  const code = normalizeBarcodeCode(obj.code, format)

  try {
    JsBarcode(canvas, code, {
      format,
      width: obj.scale,
      height: obj.h,
      displayValue: true,
      ...barcodeTextFontOptions(),
      fontSize: Math.max(10, Math.round(obj.scale * 7)),
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
      textMargin: 2,
    })
  } catch {
    const result = drawInvalid(canvas, BARCODE_INVALID_MESSAGE)
    cache.set(key, result)
    return result
  }

  const result = { canvas, width: canvas.width, height: canvas.height }
  cache.set(key, result)
  return result
}

export function getBarcodeSize(obj) {
  return renderBarcode(obj)
}

export function clearBarcodeCache() {
  cache.clear()
}
