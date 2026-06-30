import { drawMultilineTextMod } from './drawMultiLine.js'
import { drawRasterMultiline } from './drawRasterFont.js'
import {
  isRasterTextboxFont,
  isTtfTextboxFont,
  resolveTextboxFont,
  TEXTBOX_FONT_FAMILIES,
  TEXTBOX_FONT_WEIGHTS,
} from './textboxFonts.js'
import { drawTextboxInvertBackground, resolveTextboxStyle, textboxInnerRect } from './textboxStyle.js'

function drawTtfTextbox(ctx, obj, style, options = {}) {
  const font = resolveTextboxFont(obj.font)
  const family = options.fontFamily ?? TEXTBOX_FONT_FAMILIES[font]
  const minFontSize = Math.max(1, Number(obj.minFontSize) || 14)
  const maxFontSize = Math.max(minFontSize, Number(obj.maxFontSize) || 36)

  drawMultilineTextMod(ctx, obj.text, {
    rect: textboxInnerRect(obj),
    minFontSize,
    maxFontSize,
    font: family,
    weight: options.fontWeight ?? TEXTBOX_FONT_WEIGHTS[font] ?? 400,
    fillStyle: style.fillStyle,
    halign: style.halign,
    valign: style.valign,
    yNudge: options.yNudge ?? 0,
  })
}

export function drawTextbox(ctx, obj, options = {}) {
  const font = resolveTextboxFont(obj.font)
  const style = resolveTextboxStyle(obj, options)
  const outerRect = { x: obj.x, y: obj.y, width: obj.w, height: obj.h }
  const innerRect = textboxInnerRect(obj)

  if (style.invert && style.background) {
    drawTextboxInvertBackground(ctx, outerRect, style.cornerRadius, style.background)
  }

  const drawOpts = {
    rect: innerRect,
    fillStyle: style.fillStyle,
    halign: style.halign,
    valign: style.valign,
  }

  if (isRasterTextboxFont(font)) {
    drawRasterMultiline(ctx, font, obj.text, drawOpts)
    return
  }

  if (isTtfTextboxFont(font)) {
    drawTtfTextbox(ctx, obj, style, options)
  }
}
