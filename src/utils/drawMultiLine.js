import { canvasFontCss } from './textboxFonts.js'
import { alignmentOffset, measureTextLineBox } from './textboxStyle.js'

export function drawMultilineTextMod(ctx, text, opts) {
  if (!opts) opts = {}
  if (!opts.font) opts.font = 'sans-serif'
  if (!opts.rect) {
    opts.rect = {
      x: 0,
      y: 0,
      width: ctx.canvas.width,
      height: ctx.canvas.height,
    }
  }
  if (!opts.lineHeight) opts.lineHeight = 1.11
  if (!opts.minFontSize) opts.minFontSize = 30
  if (!opts.maxFontSize) opts.maxFontSize = 100

  const trimmed = (text ?? '').trim()
  if (!trimmed) return []

  const words = trimmed.split(/\s+/).filter(Boolean)
  const maxWidth = opts.rect.width
  const weight = opts.weight ?? 400
  const halign = opts.halign ?? 'left'
  const valign = opts.valign ?? 'top'

  let lastFittingLines
  let lastFittingFont
  let lastFittingSize

  ctx.textBaseline = 'alphabetic'

  for (let fontSize = opts.minFontSize; fontSize <= opts.maxFontSize; fontSize++) {
    const lineHeight = fontSize * opts.lineHeight
    ctx.font = canvasFontCss(fontSize, opts.font, weight)

    let y = 0
    const lines = []
    let line = ''
    let fail = false

    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        fail = true
      }

      const linePlus = line ? `${line} ${word}` : word
      if (ctx.measureText(linePlus).width > maxWidth && line) {
        lines.push({ text: line, y })
        line = word
        y += lineHeight
      } else {
        line = linePlus
      }
    }

    if (line) {
      lines.push({ text: line, y })
      y += lineHeight
    }

    if (fail || y > opts.rect.height) {
      break
    }

    lastFittingLines = lines
    lastFittingFont = ctx.font
    lastFittingSize = fontSize
  }

  if (!lastFittingLines?.length) {
    return []
  }

  const totalHeight = (() => {
    const lastLine = lastFittingLines[lastFittingLines.length - 1]
    const lastBox = measureTextLineBox(ctx, lastLine.text, lastFittingSize)
    return lastLine.y + lastBox.ascent + lastBox.descent
  })()
  const yNudge = opts.yNudge ?? 0
  const yOff = alignmentOffset(totalHeight, opts.rect.height, valign) + yNudge

  ctx.font = lastFittingFont
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = opts.fillStyle ?? ctx.fillStyle

  for (const line of lastFittingLines) {
    if (!opts.precalc) {
      const box = measureTextLineBox(ctx, line.text, lastFittingSize)
      const xOff = alignmentOffset(box.width, opts.rect.width, halign)
      ctx.fillText(
        line.text,
        opts.rect.x + xOff,
        opts.rect.y + yOff + line.y + box.ascent,
      )
    }
  }

  return [{ size: lastFittingSize, w: ctx.measureText(trimmed).width }]
}
