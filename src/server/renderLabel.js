import { CANVAS_WIDTH } from '../components/CanvasEditor/constants.js'
import { downsampleTo1Bit } from '../render/binarize.js'
import { isRasterTextboxFont, resolveTextboxFont } from '../utils/textboxFonts.js'
import { drawServerTextbox } from './drawTextbox.js'
import { getCanvasKit } from './loadServerFonts.js'
import { LABEL_RENDER_SCALE } from './renderConstants.js'
import { createWasmCanvas } from '../utils/wasmCanvas.js'
import { renderWasmObjects } from '../render/renderWasmObjects.js'

export { validateObjects, validateObject } from '../utils/validateObjects.js'
export { createWasmCanvas } from '../utils/wasmCanvas.js'

export async function renderLabel({ height, width = CANVAS_WIDTH, objects }) {
  const { ck } = await getCanvasKit()
  const canvasWidth = Math.max(1, Math.round(width))
  const canvasHeight = Math.max(1, Math.round(height))
  const scale = LABEL_RENDER_SCALE
  const rasterTextboxes = []
  const scalableObjects = []

  for (const obj of objects) {
    if (obj.type === 'textbox' && isRasterTextboxFont(resolveTextboxFont(obj.font))) {
      rasterTextboxes.push(obj)
    } else {
      scalableObjects.push(obj)
    }
  }

  const hiCanvas = createWasmCanvas(ck, canvasWidth * scale, canvasHeight * scale)
  const hiCtx = hiCanvas.getContext('2d')
  hiCtx.scale(scale, scale)
  hiCtx.fillStyle = '#ffffff'
  hiCtx.fillRect(0, 0, canvasWidth, canvasHeight)

  await renderWasmObjects(hiCtx, scalableObjects, ck, hiCanvas)

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
