import { barcodeTextFontOptions, paintBarcodeOnCanvas } from '../utils/barcode.js'
import { SERVER_FONT_FAMILIES } from '../utils/textboxFonts.js'
import { normalizeRotation } from '../utils/textboxRotation.js'
import { drawServerTextbox } from '../server/drawTextbox.js'
import { loadSourceImage } from '../server/loadSourceImage.js'
import { createWasmCanvas } from '../utils/wasmCanvas.js'

export function drawWasmBarcode(ctx, obj, ck) {
  const canvas = createWasmCanvas(ck, 1, 1)
  const result = paintBarcodeOnCanvas(canvas, obj, {
    textFontOptions: barcodeTextFontOptions(SERVER_FONT_FAMILIES.outfit),
  })
  if (!result) {
    canvas.dispose()
    return
  }
  ctx.drawImage(canvas, obj.x, obj.y)
  canvas.dispose()
}

export async function drawWasmPng(ctx, obj, hostCanvas) {
  if (!obj.rendered?.trim()) return

  const source = await loadSourceImage(obj.rendered, hostCanvas)
  const logicalW = source.width
  const logicalH = source.height
  const rotation = normalizeRotation(obj.rotation ?? 0)

  const paint = () => {
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(source, obj.x, obj.y, logicalW, logicalH)
    ctx.restore()
  }

  if (!rotation) {
    paint()
    return
  }

  const cx = obj.x + logicalW / 2
  const cy = obj.y + logicalH / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  paint()
  ctx.restore()
}

export async function renderWasmObjects(ctx, objects, ck, hostCanvas) {
  for (const obj of objects) {
    switch (obj.type) {
      case 'textbox':
        drawServerTextbox(ctx, obj)
        break
      case 'barcode':
        drawWasmBarcode(ctx, obj, ck)
        break
      case 'png':
        await drawWasmPng(ctx, obj, hostCanvas || ctx.canvas)
        break
      default:
        break
    }
  }
}
