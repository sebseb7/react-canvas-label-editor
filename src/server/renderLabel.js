import { createCanvas, ImageData } from 'canvas'
import JsBarcode from 'jsbarcode'
import { CANVAS_WIDTH } from '../components/CanvasEditor/constants.js'
import { binarizeImageData, downsampleTo1Bit } from '../render/binarize.js'
import {
  barcodeTextFontOptions,
  normalizeBarcodeCode,
  resolveBarcodeFormat,
} from '../utils/barcode.js'
import { isRasterTextboxFont } from '../utils/textboxFonts.js'
import { drawServerTextbox } from './drawTextbox.js'
import { loadSourceImage } from './loadSourceImage.js'
import { registerServerFonts, SERVER_FONT_FAMILIES } from './loadServerFonts.js'
import { LABEL_RENDER_SCALE } from './renderConstants.js'

function drawBarcode(ctx, obj) {
  registerServerFonts()
  const format = resolveBarcodeFormat(obj)
  const code = normalizeBarcodeCode(obj.code, format)
  const canvas = createCanvas(1, 1)

  try {
    JsBarcode(canvas, code, {
      format,
      width: obj.scale,
      height: obj.h,
      displayValue: true,
      ...barcodeTextFontOptions(SERVER_FONT_FAMILIES.outfit),
      fontSize: Math.max(10, Math.round(obj.scale * 7)),
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
      textMargin: 2,
    })
  } catch {
    return
  }

  ctx.drawImage(canvas, obj.x, obj.y)
}

async function drawPng(ctx, obj) {
  if (!obj.src?.trim()) return

  const source = await loadSourceImage(obj.src)
  const logicalW = Math.max(1, Math.round(source.width * obj.scale))
  const logicalH = Math.max(1, Math.round(source.height * obj.scale))
  const displayW = logicalW * LABEL_RENDER_SCALE
  const displayH = logicalH * LABEL_RENDER_SCALE
  const temp = createCanvas(displayW, displayH)
  const tctx = temp.getContext('2d')
  tctx.imageSmoothingEnabled = true
  tctx.drawImage(source, 0, 0, displayW, displayH)

  const imageData = tctx.getImageData(0, 0, displayW, displayH)
  binarizeImageData(imageData, obj.blackpoint ?? 128)
  tctx.putImageData(imageData, 0, 0)
  ctx.drawImage(temp, obj.x, obj.y, logicalW, logicalH)
}

export async function renderLabel({ height, objects }) {
  const canvasHeight = Math.max(1, Math.round(height))
  const scale = LABEL_RENDER_SCALE
  const rasterTextboxes = []

  const hiCanvas = createCanvas(CANVAS_WIDTH * scale, canvasHeight * scale)
  const hiCtx = hiCanvas.getContext('2d')
  hiCtx.scale(scale, scale)
  hiCtx.fillStyle = '#ffffff'
  hiCtx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)

  for (const obj of objects) {
    switch (obj.type) {
      case 'textbox':
        if (isRasterTextboxFont(obj.font ?? 'raster7x9')) {
          rasterTextboxes.push(obj)
        } else {
          drawServerTextbox(hiCtx, obj)
        }
        break
      case 'barcode':
        drawBarcode(hiCtx, obj)
        break
      case 'png':
        await drawPng(hiCtx, obj)
        break
      default:
        break
    }
  }

  const hiRes = hiCtx.getImageData(0, 0, CANVAS_WIDTH * scale, canvasHeight * scale)
  const oneBit = downsampleTo1Bit(hiRes, CANVAS_WIDTH, canvasHeight, 128)

  const out = createCanvas(CANVAS_WIDTH, canvasHeight)
  const outCtx = out.getContext('2d')
  outCtx.putImageData(new ImageData(oneBit.data, oneBit.width, oneBit.height), 0, 0)

  // Raster fonts are already 1-bit pixels — draw at 1:1 on the final canvas, never resample.
  for (const obj of rasterTextboxes) {
    drawServerTextbox(outCtx, obj)
  }

  return out.toBuffer('image/png')
}
