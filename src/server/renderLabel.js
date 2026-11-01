import { CANVAS_WIDTH } from '../components/CanvasEditor/constants.js'
import { downsampleTo1Bit } from '../render/binarize.js'
import { barcodeTextFontOptions, paintBarcodeOnCanvas } from '../utils/barcode.js'
import { isRasterTextboxFont, resolveTextboxFont } from '../utils/textboxFonts.js'
import { normalizeRotation } from '../utils/textboxRotation.js'
import { drawServerTextbox } from './drawTextbox.js'
import { loadSourceImage } from './loadSourceImage.js'
import { getCanvasKit, SERVER_FONT_FAMILIES } from './loadServerFonts.js'
import { LABEL_RENDER_SCALE } from './renderConstants.js'

export { validateObjects, validateObject } from '../utils/validateObjects.js'

export function createWasmCanvas(ck, w = 1, h = 1) {
  let width = Math.max(1, Math.round(w))
  let height = Math.max(1, Math.round(h))
  let innerCanvas = ck.MakeCanvas(width, height)
  let rawCtx = innerCanvas.getContext('2d')

  let state = {
    textBaseline: 'alphabetic',
    textAlign: 'left',
  }
  const stateStack = []

  const wrapper = {
    get width() {
      return width
    },
    set width(val) {
      width = Math.max(1, Math.round(val))
      innerCanvas.dispose()
      innerCanvas = ck.MakeCanvas(width, height)
      rawCtx = innerCanvas.getContext('2d')
    },
    get height() {
      return height
    },
    set height(val) {
      height = Math.max(1, Math.round(val))
      innerCanvas.dispose()
      innerCanvas = ck.MakeCanvas(width, height)
      rawCtx = innerCanvas.getContext('2d')
    },
    getContext(type = '2d', opts) {
      if (!rawCtx) rawCtx = innerCanvas.getContext(type, opts)
      return new Proxy({}, {
        get(target, prop) {
          if (prop === 'canvas') return wrapper
          if (prop === 'textBaseline') return state.textBaseline
          if (prop === 'textAlign') return state.textAlign
          if (prop === 'save') {
            return function () {
              stateStack.push({ ...state })
              return rawCtx.save()
            }
          }
          if (prop === 'restore') {
            return function () {
              if (stateStack.length > 0) {
                state = stateStack.pop()
              }
              return rawCtx.restore()
            }
          }
          if (prop === 'measureText') {
            return function (text) {
              const str = String(text ?? '')
              const m = rawCtx.measureText(str)
              const metrics = rawCtx.je?.getMetrics()
              const ascent = metrics ? -metrics.ascent : (rawCtx.je?.getSize() || 10)
              const descent = metrics ? metrics.descent : 0
              return {
                width: m.width,
                actualBoundingBoxAscent: ascent,
                actualBoundingBoxDescent: descent,
                fontBoundingBoxAscent: ascent,
                fontBoundingBoxDescent: descent,
              }
            }
          }
          if (prop === 'fillText') {
            return function (text, x, y) {
              const str = String(text ?? '')
              if (!str || !/\S/.test(str)) return

              let drawX = x
              let drawY = y
              const m = rawCtx.measureText(str)

              if (state.textAlign === 'center') {
                drawX -= m.width / 2
              } else if (state.textAlign === 'right' || state.textAlign === 'end') {
                drawX -= m.width
              }

              const font = rawCtx.je
              const size = font?.getSize() || 14
              const metrics = font?.getMetrics()
              const ascent = metrics ? -metrics.ascent : size
              const descent = metrics ? metrics.descent : 0
              const emHeight = ascent + descent || size
              const topOffset = size * (ascent / emHeight)

              if (state.textBaseline === 'top') {
                drawY += topOffset
              } else if (state.textBaseline === 'middle') {
                drawY += topOffset - size / 2
              } else if (state.textBaseline === 'bottom') {
                drawY += topOffset - size
              } else if (state.textBaseline === 'hanging') {
                drawY += topOffset * 0.8
              } else if (state.textBaseline === 'ideographic') {
                drawY -= descent
              }

              return rawCtx.fillText(str, drawX, drawY)
            }
          }
          if (prop === 'strokeText') {
            return function (text, x, y) {
              const str = String(text ?? '')
              if (!str || !/\S/.test(str)) return

              let drawX = x
              let drawY = y
              const m = rawCtx.measureText(str)

              if (state.textAlign === 'center') {
                drawX -= m.width / 2
              } else if (state.textAlign === 'right' || state.textAlign === 'end') {
                drawX -= m.width
              }

              const font = rawCtx.je
              const size = font?.getSize() || 14
              const metrics = font?.getMetrics()
              const ascent = metrics ? -metrics.ascent : size
              const descent = metrics ? metrics.descent : 0
              const emHeight = ascent + descent || size
              const topOffset = size * (ascent / emHeight)

              if (state.textBaseline === 'top') {
                drawY += topOffset
              } else if (state.textBaseline === 'middle') {
                drawY += topOffset - size / 2
              } else if (state.textBaseline === 'bottom') {
                drawY += topOffset - size
              } else if (state.textBaseline === 'hanging') {
                drawY += topOffset * 0.8
              } else if (state.textBaseline === 'ideographic') {
                drawY -= descent
              }

              return rawCtx.strokeText(str, drawX, drawY)
            }
          }
          if (prop === 'drawImage') {
            return function (image, ...args) {
              if (image && image.Xe && typeof image.Xe.makeImageSnapshot === 'function') {
                const snap = image.Xe.makeImageSnapshot()
                const res = rawCtx.drawImage.call(rawCtx, snap, ...args)
                snap.delete()
                return res
              }
              return rawCtx.drawImage.call(rawCtx, image, ...args)
            }
          }
          const val = rawCtx[prop]
          return typeof val === 'function' ? val.bind(rawCtx) : val
        },
        set(target, prop, value) {
          if (prop === 'textBaseline') {
            state.textBaseline = value
            return true
          }
          if (prop === 'textAlign') {
            state.textAlign = value
            return true
          }
          if (prop === 'font') {
            // Strip quotes around font family names for CanvasKit parser compatibility
            rawCtx.font = typeof value === 'string' ? value.replace(/["']/g, '') : value
            return true
          }
          rawCtx[prop] = value
          return true
        },
      })
    },
    get Xe() {
      return innerCanvas.Xe
    },
    decodeImage(bytes) {
      return innerCanvas.decodeImage(bytes)
    },
    toBuffer(format = 'image/png') {
      const snap = innerCanvas.Xe.makeImageSnapshot()
      const imageFormat = format === 'image/jpeg' ? ck.ImageFormat.JPEG : ck.ImageFormat.PNG
      const bytes = snap.encodeToBytes(imageFormat)
      snap.delete()
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    },
    toDataURL(type, quality) {
      return innerCanvas.toDataURL(type, quality)
    },
    dispose() {
      innerCanvas.dispose()
    },
  }

  return wrapper
}

function drawBarcode(ctx, obj, ck) {
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

/**
 * Blit the editor-prerendered 1-bit PNG.
 * Drawn with smoothing off so the LABEL_RENDER_SCALE transform nearest-neighbor
 * replicates pixels; the final downsample recovers the exact 1-bit bitmap.
 */
async function drawPng(ctx, obj, hostCanvas) {
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

export async function renderLabel({ height, width = CANVAS_WIDTH, objects }) {
  const { ck } = await getCanvasKit()
  const canvasWidth = Math.max(1, Math.round(width))
  const canvasHeight = Math.max(1, Math.round(height))
  const scale = LABEL_RENDER_SCALE
  const rasterTextboxes = []

  const hiCanvas = createWasmCanvas(ck, canvasWidth * scale, canvasHeight * scale)
  const hiCtx = hiCanvas.getContext('2d')
  hiCtx.scale(scale, scale)
  hiCtx.fillStyle = '#ffffff'
  hiCtx.fillRect(0, 0, canvasWidth, canvasHeight)

  for (const obj of objects) {
    switch (obj.type) {
      case 'textbox':
        if (isRasterTextboxFont(resolveTextboxFont(obj.font))) {
          rasterTextboxes.push(obj)
        } else {
          drawServerTextbox(hiCtx, obj)
        }
        break
      case 'barcode':
        drawBarcode(hiCtx, obj, ck)
        break
      case 'png':
        await drawPng(hiCtx, obj, hiCanvas)
        break
      default:
        break
    }
  }

  const hiRes = hiCtx.getImageData(0, 0, canvasWidth * scale, canvasHeight * scale)
  const oneBit = downsampleTo1Bit(hiRes, canvasWidth, canvasHeight, 128)

  const out = createWasmCanvas(ck, canvasWidth, canvasHeight)
  const outCtx = out.getContext('2d')
  outCtx.putImageData({ data: oneBit.data, width: oneBit.width, height: oneBit.height }, 0, 0)

  // Raster fonts are already 1-bit pixels — draw at 1:1 on the final canvas, never resample.
  for (const obj of rasterTextboxes) {
    drawServerTextbox(outCtx, obj)
  }

  const buffer = out.toBuffer('image/png')
  hiCanvas.dispose()
  out.dispose()

  return buffer
}
