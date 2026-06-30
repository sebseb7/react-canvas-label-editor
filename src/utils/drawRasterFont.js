import {
  RASTER_FONT_BITMAP as BITMAP_7X9,
  RASTER_FONT_HEIGHT as HEIGHT_7X9,
  RASTER_FONT_WIDTH as WIDTH_7X9,
} from '../fonts/font7x9.js'
import { alignmentOffset } from './textboxStyle.js'

/** @typedef {'raster7x9'} RasterFontId */

/** @type {Record<RasterFontId, { bitmap: Uint8Array, width: number, height: number, glyphBytes: number, rowBits: (glyphOffset: number, row: number) => number }>} */
export const RASTER_FONTS = {
  raster7x9: {
    bitmap: BITMAP_7X9,
    width: WIDTH_7X9,
    height: HEIGHT_7X9,
    glyphBytes: HEIGHT_7X9,
    rowBits(glyphOffset, row) {
      return (BITMAP_7X9[glyphOffset + row] >> 1) & 0x7f
    },
  },
}

function parseRgb(fillStyle) {
  if (!fillStyle || typeof fillStyle !== 'string') return [0, 0, 0]
  const hex = fillStyle.trim()
  if (!hex.startsWith('#')) return [0, 0, 0]

  const h = hex.slice(1)
  if (h.length === 3) {
    return [
      Number.parseInt(h[0] + h[0], 16),
      Number.parseInt(h[1] + h[1], 16),
      Number.parseInt(h[2] + h[2], 16),
    ]
  }
  if (h.length >= 6) {
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
    ]
  }
  return [0, 0, 0]
}

function setPixel(data, width, height, x, y, r, g, b) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= width || py >= height) return
  const i = (py * width + px) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = 255
}

function drawGlyphPixels(data, regionW, regionH, font, charCode, originX, originY, rgb) {
  const glyphOffset = charCode * font.glyphBytes
  const [r, g, b] = rgb

  for (let row = 0; row < font.height; row++) {
    const rowBits = font.rowBits(glyphOffset, row)
    for (let col = 0; col < font.width; col++) {
      if ((rowBits >> (font.width - 1 - col)) & 1) {
        setPixel(data, regionW, regionH, originX + col, originY + row, r, g, b)
      }
    }
  }
}

function layoutRasterLines(text, rect, font) {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return null

  const words = trimmed.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  let y = 0

  for (const word of words) {
    if (word.length * font.width > rect.width) {
      return null
    }

    const linePlus = line ? `${line} ${word}` : word
    const lineWidth = linePlus.length * font.width
    if (lineWidth > rect.width && line) {
      lines.push({ text: line, y })
      line = word
      y += font.height
      if (y + font.height > rect.height) return null
    } else {
      line = linePlus
    }
  }

  if (line) {
    lines.push({ text: line, y })
    y += font.height
  }

  if (y > rect.height) return null

  return { lines }
}

export function drawRasterMultiline(ctx, fontId, text, opts) {
  const font = RASTER_FONTS[fontId]
  if (!font) return []

  const rect = opts.rect ?? { x: 0, y: 0, width: ctx.canvas.width, height: ctx.canvas.height }
  const layout = layoutRasterLines(text, rect, font)
  if (!layout) return []

  const halign = opts.halign ?? 'left'
  const valign = opts.valign ?? 'top'
  const totalHeight =
    layout.lines[layout.lines.length - 1].y + font.height
  const yOff = Math.round(alignmentOffset(totalHeight, rect.height, valign))

  const x0 = Math.max(0, Math.round(rect.x))
  const y0 = Math.max(0, Math.round(rect.y))
  const regionW = Math.max(1, Math.round(rect.width))
  const regionH = Math.max(1, Math.round(rect.height))
  const clipW = Math.min(regionW, ctx.canvas.width - x0)
  const clipH = Math.min(regionH, ctx.canvas.height - y0)
  if (clipW <= 0 || clipH <= 0) return []

  const imageData = ctx.getImageData(x0, y0, clipW, clipH)
  const rgb = parseRgb(opts.fillStyle ?? '#000000')

  for (const line of layout.lines) {
    const lineWidth = line.text.length * font.width
    const xOff = Math.round(alignmentOffset(lineWidth, rect.width, halign))
    let x = xOff
    for (const ch of line.text) {
      const code = ch.charCodeAt(0) & 0xff
      drawGlyphPixels(imageData.data, clipW, clipH, font, code, x, yOff + line.y, rgb)
      x += font.width
    }
  }

  ctx.putImageData(imageData, x0, y0)

  const totalWidth = layout.lines.reduce(
    (max, line) => Math.max(max, line.text.length * font.width),
    0,
  )

  return [{ size: font.height, w: totalWidth }]
}
