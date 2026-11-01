import { drawTextbox } from '../utils/drawTextbox.js'
import {
  isTtfTextboxFont,
  resolveTextboxFont,
  serverFontFamily,
  TEXTBOX_FONT_WEIGHTS,
} from '../utils/textboxFonts.js'

export function drawServerTextbox(ctx, obj) {
  const font = resolveTextboxFont(obj.font)
  const options = { fillStyle: '#000000' }

  if (isTtfTextboxFont(font)) {
    options.fontFamily = serverFontFamily(font)
    options.fontWeight = TEXTBOX_FONT_WEIGHTS[font]
  }

  drawTextbox(ctx, obj, options)
}
