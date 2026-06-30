export function isRawSvg(src) {
  const trimmed = src.trim()
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')
}

export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

/** Data URL or raw SVG/base64 suitable for assigning to Image.src */
export function imageSrcForLoad(src) {
  if (!src) return ''
  const trimmed = src.trim()
  if (trimmed.startsWith('data:')) return trimmed
  if (isRawSvg(trimmed)) return svgToDataUrl(trimmed)
  if (trimmed.startsWith('iVBOR')) return `data:image/png;base64,${trimmed}`
  if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`
  return `data:image/png;base64,${trimmed}`
}

/** Normalize pasted or uploaded values for JSON storage. */
export function imageSrcForStore(src) {
  if (!src) return ''
  const trimmed = src.trim()
  if (isRawSvg(trimmed)) return trimmed
  if (trimmed.startsWith('data:image/svg+xml')) {
    const comma = trimmed.indexOf(',')
    const meta = trimmed.slice(0, comma)
    const payload = trimmed.slice(comma + 1)
    if (meta.includes(';base64')) {
      return atob(payload)
    }
    return decodeURIComponent(payload)
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
