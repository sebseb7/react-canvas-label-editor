import QRCode from 'qrcode'
import { PNG_SCALE_MIN, TEXTBOX_ROTATIONS } from '../components/CanvasEditor/constants.js'
import { imageSrcFormat } from './imageSrc.js'
import { TEXTBOX_FONTS } from './textboxFonts.js'
import { TEXTBOX_HALIGNS, TEXTBOX_VALIGNS } from './textboxStyle.js'

export const VALID_OBJECT_TYPES = ['textbox', 'barcode', 'png']
export const BARCODE_FORMATS = ['EAN8', 'EAN13', 'CODE128', 'QR']
const ALLOWED_FONTS = [...TEXTBOX_FONTS, 'raster9x8']

function isFiniteNumber(val) {
  return typeof val === 'number' && Number.isFinite(val)
}

/**
 * Validates a single editor object.
 *
 * @param {any} obj
 * @param {string} [prefix='object']
 * @returns {string[]} List of validation error messages
 */
export function validateObject(obj, prefix = 'object') {
  const errors = []

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return [`${prefix}: must be a plain object`]
  }

  // Common: id
  if (obj.id === undefined || obj.id === null || String(obj.id).trim() === '') {
    errors.push(`${prefix}: "id" is required and must be a non-empty string or number`)
  }

  // Common: type
  if (!VALID_OBJECT_TYPES.includes(obj.type)) {
    errors.push(
      `${prefix}: "type" must be one of ${VALID_OBJECT_TYPES.map((t) => `"${t}"`).join(', ')} (received ${JSON.stringify(obj.type)})`,
    )
    return errors
  }

  // Common: x, y
  if (!isFiniteNumber(obj.x)) {
    errors.push(`${prefix}: "x" must be a finite number`)
  }
  if (!isFiniteNumber(obj.y)) {
    errors.push(`${prefix}: "y" must be a finite number`)
  }

  if (obj.type === 'textbox') {
    if (typeof obj.text !== 'string') {
      errors.push(`${prefix}: "text" must be a string`)
    }
    if (!isFiniteNumber(obj.w) || obj.w <= 0) {
      errors.push(`${prefix}: "w" must be a positive number`)
    }
    if (!isFiniteNumber(obj.h) || obj.h <= 0) {
      errors.push(`${prefix}: "h" must be a positive number`)
    }
    if (obj.font !== undefined && obj.font !== null && !ALLOWED_FONTS.includes(obj.font)) {
      errors.push(
        `${prefix}: invalid font "${obj.font}". Must be one of: ${TEXTBOX_FONTS.join(', ')}`,
      )
    }
    if (
      obj.rotation !== undefined &&
      obj.rotation !== null &&
      (!isFiniteNumber(obj.rotation) || !TEXTBOX_ROTATIONS.includes(obj.rotation))
    ) {
      errors.push(
        `${prefix}: "rotation" must be one of: ${TEXTBOX_ROTATIONS.join(', ')} (received ${obj.rotation})`,
      )
    }
    if (
      obj.halign !== undefined &&
      obj.halign !== null &&
      !TEXTBOX_HALIGNS.includes(obj.halign)
    ) {
      errors.push(
        `${prefix}: "halign" must be one of: ${TEXTBOX_HALIGNS.join(', ')} (received ${JSON.stringify(obj.halign)})`,
      )
    }
    if (
      obj.valign !== undefined &&
      obj.valign !== null &&
      !TEXTBOX_VALIGNS.includes(obj.valign)
    ) {
      errors.push(
        `${prefix}: "valign" must be one of: ${TEXTBOX_VALIGNS.join(', ')} (received ${JSON.stringify(obj.valign)})`,
      )
    }
    if (obj.invert !== undefined && obj.invert !== null && typeof obj.invert !== 'boolean') {
      errors.push(`${prefix}: "invert" must be a boolean`)
    }
    if (
      obj.cornerRadius !== undefined &&
      obj.cornerRadius !== null &&
      (!isFiniteNumber(obj.cornerRadius) || obj.cornerRadius < 0)
    ) {
      errors.push(`${prefix}: "cornerRadius" must be a non-negative number`)
    }
    const hasMin = isFiniteNumber(obj.minFontSize)
    const hasMax = isFiniteNumber(obj.maxFontSize)
    if (obj.minFontSize !== undefined && obj.minFontSize !== null) {
      if (!hasMin || obj.minFontSize <= 0) {
        errors.push(`${prefix}: "minFontSize" must be a positive number`)
      }
    }
    if (obj.maxFontSize !== undefined && obj.maxFontSize !== null) {
      if (!hasMax || obj.maxFontSize <= 0) {
        errors.push(`${prefix}: "maxFontSize" must be a positive number`)
      }
    }
    if (hasMin && hasMax && obj.minFontSize > obj.maxFontSize) {
      errors.push(
        `${prefix}: "minFontSize" (${obj.minFontSize}) cannot be greater than "maxFontSize" (${obj.maxFontSize})`,
      )
    }
    const left = obj.marginLeft
    const right = obj.marginRight
    const top = obj.marginTop
    const bottom = obj.marginBottom
    for (const [marginName, val] of [
      ['marginLeft', left],
      ['marginTop', top],
      ['marginRight', right],
      ['marginBottom', bottom],
    ]) {
      if (val !== undefined && val !== null && (!isFiniteNumber(val) || val < 0)) {
        errors.push(`${prefix}: "${marginName}" must be a non-negative number`)
      }
    }
    if (
      isFiniteNumber(obj.w) &&
      isFiniteNumber(left) &&
      isFiniteNumber(right) &&
      left >= 0 &&
      right >= 0 &&
      left + right >= obj.w
    ) {
      errors.push(
        `${prefix}: total horizontal margins (${left} + ${right} = ${left + right}) must be less than width (${obj.w})`,
      )
    }
    if (
      isFiniteNumber(obj.h) &&
      isFiniteNumber(top) &&
      isFiniteNumber(bottom) &&
      top >= 0 &&
      bottom >= 0 &&
      top + bottom >= obj.h
    ) {
      errors.push(
        `${prefix}: total vertical margins (${top} + ${bottom} = ${top + bottom}) must be less than height (${obj.h})`,
      )
    }
    if (
      obj.blackpoint !== undefined &&
      obj.blackpoint !== null &&
      (!isFiniteNumber(obj.blackpoint) || obj.blackpoint < 0 || obj.blackpoint > 255)
    ) {
      errors.push(`${prefix}: "blackpoint" must be a number between 0 and 255`)
    }
  } else if (obj.type === 'barcode') {
    const rawCode = obj.code
    const codeStr = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : ''

    if (!codeStr) {
      errors.push(`${prefix}: "code" is required and cannot be empty`)
    }

    if (obj.format !== undefined && obj.format !== null && !BARCODE_FORMATS.includes(obj.format)) {
      errors.push(
        `${prefix}: "format" must be one of: ${BARCODE_FORMATS.join(', ')} (received ${JSON.stringify(obj.format)})`,
      )
    }

    if (!isFiniteNumber(obj.scale) || obj.scale < 1) {
      errors.push(`${prefix}: "scale" (module width) must be a number >= 1`)
    }

    const format = obj.format || (codeStr.replace(/\D/g, '').length <= 8 ? 'EAN8' : 'EAN13')

    if (format !== 'QR') {
      if (!isFiniteNumber(obj.h) || obj.h <= 0) {
        errors.push(`${prefix}: "h" (bar height) must be a positive number`)
      }
    }

    if (codeStr) {
      if (format === 'EAN8') {
        if (/\D/.test(codeStr)) {
          errors.push(`${prefix}: EAN8 code "${codeStr}" must contain only digits`)
        } else if (codeStr.length > 8) {
          errors.push(`${prefix}: EAN8 code "${codeStr}" cannot exceed 8 digits`)
        }
      } else if (format === 'EAN13') {
        if (/\D/.test(codeStr)) {
          errors.push(`${prefix}: EAN13 code "${codeStr}" must contain only digits`)
        } else if (codeStr.length > 13) {
          errors.push(`${prefix}: EAN13 code "${codeStr}" cannot exceed 13 digits`)
        }
      } else if (format === 'CODE128') {
        // Code 128 accepts standard ASCII (0-127)
        const hasNonAscii = Array.from(codeStr).some((c) => c.charCodeAt(0) > 127)
        if (hasNonAscii) {
          errors.push(`${prefix}: CODE128 code contains non-ASCII characters`)
        }
      } else if (format === 'QR') {
        try {
          QRCode.create(codeStr)
        } catch (err) {
          errors.push(`${prefix}: invalid QR code content: ${err.message}`)
        }
      }
    }
  } else if (obj.type === 'png') {
    if (typeof obj.src !== 'string' || !obj.src.trim()) {
      errors.push(`${prefix}: "src" is required and must be a non-empty string`)
    } else {
      const format = imageSrcFormat(obj.src)
      if (!format || format === 'unknown') {
        errors.push(
          `${prefix}: "src" format is not supported (expected SVG, PNG, or JPEG)`,
        )
      }
    }

    if (!isFiniteNumber(obj.scale) || obj.scale < PNG_SCALE_MIN) {
      errors.push(`${prefix}: "scale" must be a number >= ${PNG_SCALE_MIN}`)
    }

    if (
      obj.rotation !== undefined &&
      obj.rotation !== null &&
      (!isFiniteNumber(obj.rotation) || !TEXTBOX_ROTATIONS.includes(obj.rotation))
    ) {
      errors.push(
        `${prefix}: "rotation" must be one of: ${TEXTBOX_ROTATIONS.join(', ')} (received ${obj.rotation})`,
      )
    }

    if (
      obj.blackpoint !== undefined &&
      obj.blackpoint !== null &&
      (!isFiniteNumber(obj.blackpoint) || obj.blackpoint < 0 || obj.blackpoint > 255)
    ) {
      errors.push(`${prefix}: "blackpoint" must be a number between 0 and 255`)
    }

    if (
      obj.rendered !== undefined &&
      obj.rendered !== null &&
      typeof obj.rendered !== 'string'
    ) {
      errors.push(`${prefix}: "rendered" must be a string`)
    }
  }

  return errors
}

/**
 * Validates an array of label editor objects.
 *
 * @param {any} objects An array of label canvas objects
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateObjects(objects) {
  if (!Array.isArray(objects)) {
    return {
      valid: false,
      errors: ['objects must be an array'],
    }
  }

  const errors = []
  const seenIds = new Set()

  for (let index = 0; index < objects.length; index++) {
    const obj = objects[index]
    const idHint = obj && typeof obj === 'object' && obj.id ? ` (id: "${obj.id}")` : ''
    const prefix = `objects[${index}]${idHint}`

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if (obj.id !== undefined && obj.id !== null && String(obj.id).trim() !== '') {
        const idKey = String(obj.id)
        if (seenIds.has(idKey)) {
          errors.push(`${prefix}: duplicate id "${obj.id}"`)
        } else {
          seenIds.add(idKey)
        }
      }
    }

    const itemErrors = validateObject(obj, prefix)
    errors.push(...itemErrors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
