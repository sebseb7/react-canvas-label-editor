import { canvasFontCss } from './textboxFonts.js'
import { alignmentOffset } from './textboxStyle.js'

function splitTextParagraphs(text) {
  return (text ?? '').replace(/\r\n/g, '\n').split('\n')
}

function wrapWords(ctx, words, maxWidth, lineHeight, startY) {
  let y = startY
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

  return { lines, y, fail }
}

function layoutParagraphLines(ctx, text, maxWidth, lineHeight) {
  const paragraphs = splitTextParagraphs(text)
  let y = 0
  const lines = []
  let fail = false

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push({ text: '', y })
      y += lineHeight
      continue
    }

    const wrapped = wrapWords(ctx, words, maxWidth, lineHeight, y)
    lines.push(...wrapped.lines)
    y = wrapped.y
    fail = fail || wrapped.fail
  }

  return { lines, y, fail }
}

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

  const normalized = (text ?? '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) return []

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

    const { lines, y, fail } = layoutParagraphLines(ctx, normalized, maxWidth, lineHeight)

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

  const lineHeightPx = lastFittingSize * opts.lineHeight
  const totalHeight =
    lastFittingLines[lastFittingLines.length - 1].y + lineHeightPx
  const yNudge = opts.yNudge ?? 0
  const yOff = alignmentOffset(totalHeight, opts.rect.height, valign) + yNudge

  ctx.font = lastFittingFont
  ctx.textBaseline = 'top'
  ctx.fillStyle = opts.fillStyle ?? ctx.fillStyle

  for (const line of lastFittingLines) {
    if (!opts.precalc) {
      const width = ctx.measureText(line.text).width
      const xOff = alignmentOffset(width, opts.rect.width, halign)
      ctx.fillText(
        line.text,
        opts.rect.x + xOff,
        opts.rect.y + yOff + line.y,
      )
    }
  }

  return [{ size: lastFittingSize, w: ctx.measureText(normalized.trim()).width }]
}
