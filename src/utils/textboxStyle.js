/** @typedef {'left' | 'center' | 'right'} TextboxHalign */
/** @typedef {'top' | 'middle' | 'bottom'} TextboxValign */

export const TEXTBOX_HALIGNS = /** @type {const} */ (['left', 'center', 'right'])
export const TEXTBOX_VALIGNS = /** @type {const} */ (['top', 'middle', 'bottom'])

export const TEXTBOX_HALIGN_LABELS = {
  left: 'Links',
  center: 'Mitte',
  right: 'Rechts',
}

export const TEXTBOX_VALIGN_LABELS = {
  top: 'Oben',
  middle: 'Mitte',
  bottom: 'Unten',
}

/** @param {CanvasRenderingContext2D} ctx */
export function measureTextLineBox(ctx, text, fontSize) {
  const m = ctx.measureText(text)
  const ascent =
    (typeof m.actualBoundingBoxAscent === 'number' && m.actualBoundingBoxAscent > 0
      ? m.actualBoundingBoxAscent
      : undefined) ??
    m.fontBoundingBoxAscent ??
    m.emHeightAscent ??
    fontSize * 0.8
  const descent =
    (typeof m.actualBoundingBoxDescent === 'number' && m.actualBoundingBoxDescent >= 0
      ? m.actualBoundingBoxDescent
      : undefined) ??
    m.fontBoundingBoxDescent ??
    m.emHeightDescent ??
    fontSize * 0.2
  return { width: m.width, ascent, descent }
}

export function resolveTextboxHalign(value) {
  return TEXTBOX_HALIGNS.includes(value) ? value : 'left'
}

export function resolveTextboxValign(value) {
  return TEXTBOX_VALIGNS.includes(value) ? value : 'top'
}

/** @param {'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'} align */
export function alignmentOffset(size, container, align) {
  if (align === 'center' || align === 'middle') {
    return Math.max(0, (container - size) / 2)
  }
  if (align === 'right' || align === 'bottom') {
    return Math.max(0, container - size)
  }
  return 0
}

export function resolveTextboxStyle(obj, options = {}) {
  const invert = Boolean(obj.invert)
  const defaultFill = options.fillStyle ?? '#000000'

  return {
    invert,
    cornerRadius: invert ? Math.max(0, Number(obj.cornerRadius) || 0) : 0,
    halign: resolveTextboxHalign(obj.halign),
    valign: resolveTextboxValign(obj.valign),
    fillStyle: invert ? '#ffffff' : defaultFill,
    background: invert ? '#000000' : null,
  }
}

export function fillRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  if (r <= 0) {
    ctx.fillRect(x, y, width, height)
    return
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, r)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

export function drawTextboxInvertBackground(ctx, rect, cornerRadius, color = '#000000') {
  ctx.fillStyle = color
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, cornerRadius)
}

export function textboxInnerRect(obj) {
  const left = Math.max(0, Number(obj.marginLeft) || 0)
  const top = Math.max(0, Number(obj.marginTop) || 0)
  const right = Math.max(0, Number(obj.marginRight) || 0)
  const bottom = Math.max(0, Number(obj.marginBottom) || 0)
  return {
    x: obj.x + left,
    y: obj.y + top,
    width: Math.max(1, obj.w - left - right),
    height: Math.max(1, obj.h - top - bottom),
  }
}
