export function isRawSvg(src) {
  const trimmed = src.trim()
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')
}

export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

/**
 * When an SVG only declares a viewBox (no width/height), browsers fall back to the
 * CSS "default object size" algorithm (~300x150, ratio-constrained) for an <img>'s
 * naturalWidth/naturalHeight, while the server rasterizer (sharp/librsvg) instead
 * renders at the viewBox's literal pixel size. That mismatch made the same `scale`
 * value produce different pixel sizes in the browser preview vs. the backend PNG.
 * Baking explicit width/height (from the viewBox) into the stored SVG makes both
 * sides agree on the same intrinsic size.
 */
export function ensureSvgDimensions(svg) {
  const tagMatch = svg.match(/<svg\b[^>]*>/i)
  if (!tagMatch) return svg
  const tag = tagMatch[0]
  const hasWidth = /\swidth\s*=/i.test(tag)
  const hasHeight = /\sheight\s*=/i.test(tag)
  if (hasWidth && hasHeight) return svg

  const viewBoxMatch = tag.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)
  if (!viewBoxMatch) return svg
  const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return svg
  const [, , vbWidth, vbHeight] = parts
  if (!(vbWidth > 0) || !(vbHeight > 0)) return svg

  const additions = `${hasWidth ? '' : ` width="${vbWidth}"`}${hasHeight ? '' : ` height="${vbHeight}"`}`
  const newTag = tag.replace(/^<svg\b/i, `<svg${additions}`)
  return svg.slice(0, tagMatch.index) + newTag + svg.slice(tagMatch.index + tag.length)
}

/** Data URL or raw SVG/base64 suitable for assigning to Image.src */
export function imageSrcForLoad(src) {
  if (!src) return ''
  const trimmed = src.trim()
  if (trimmed.startsWith('data:')) return trimmed
  if (isRawSvg(trimmed)) return svgToDataUrl(ensureSvgDimensions(trimmed))
  if (trimmed.startsWith('iVBOR')) return `data:image/png;base64,${trimmed}`
  if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`
  return `data:image/png;base64,${trimmed}`
}

/** Normalize pasted or uploaded values for JSON storage. */
export function imageSrcForStore(src) {
  if (!src) return ''
  const trimmed = src.trim()
  if (isRawSvg(trimmed)) return ensureSvgDimensions(trimmed)
  if (trimmed.startsWith('data:image/svg+xml')) {
    const comma = trimmed.indexOf(',')
    const meta = trimmed.slice(0, comma)
    const payload = trimmed.slice(comma + 1)
    const decoded = meta.includes(';base64') ? atob(payload) : decodeURIComponent(payload)
    return ensureSvgDimensions(decoded)
  }
  if (
    trimmed.startsWith('data:image/png') ||
    trimmed.startsWith('data:image/jpeg') ||
    trimmed.startsWith('data:image/jpg')
  ) {
    return trimmed
  }
  if (trimmed.startsWith('iVBOR')) return `data:image/png;base64,${trimmed}`
  if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`
  return trimmed
}

export function imageSrcFormat(src) {
  if (!src) return null
  const trimmed = src.trim()
  if (isRawSvg(trimmed) || trimmed.startsWith('data:image/svg')) return 'svg'
  if (trimmed.startsWith('data:image/jpeg') || trimmed.startsWith('data:image/jpg')) {
    return 'jpeg'
  }
  if (trimmed.startsWith('data:image/png') || trimmed.startsWith('iVBOR')) return 'png'
  if (trimmed.startsWith('/9j/')) return 'jpeg'
  return 'unknown'
}

export function imageSrcSummary(src) {
  const format = imageSrcFormat(src)
  if (!format) return 'No image'
  const trimmed = src.trim()
  const bytes = format === 'svg' ? trimmed.length : trimmed.length
  return `${format.toUpperCase()} (${bytes} chars)`
}
