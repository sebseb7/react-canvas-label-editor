/**
 * Luminance after compositing onto a white background (correct for antialiased ink).
 */
export function compositeLuminanceOnWhite(r, g, b, a) {
  const alpha = a / 255
  const inv = 1 - alpha
  const cr = r * alpha + 255 * inv
  const cg = g * alpha + 255 * inv
  const cb = b * alpha + 255 * inv
  return 0.299 * cr + 0.587 * cg + 0.114 * cb
}

/** Below this, a source pixel is treated as fully transparent rather than ink. */
const ALPHA_CUTOFF = 128

function writePixel(data, index, value, alpha = 255) {
  data[index] = value
  data[index + 1] = value
  data[index + 2] = value
  data[index + 3] = alpha
}

/**
 * Thresholds a single asset's pixels to 1-bit ink while keeping mostly-transparent
 * pixels transparent, so PNG/SVG assets with a transparent background don't paint
 * an opaque white box over whatever is layered underneath them.
 */
function binarizeThreshold(imageData, threshold) {
  const { data, width, height } = imageData
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < ALPHA_CUTOFF) {
        writePixel(data, i, 255, 0)
        continue
      }
      const lum = compositeLuminanceOnWhite(data[i], data[i + 1], data[i + 2], data[i + 3])
      writePixel(data, i, lum <= threshold ? 0 : 255)
    }
  }
}

/**
 * Average luminance in each source block, then threshold — best for supersampled text.
 */
export function downsampleTo1Bit(imageData, outWidth, outHeight, blackpoint = 128) {
  const { data, width, height } = imageData
  const threshold = Math.max(0, Math.min(255, blackpoint))
  const out = new Uint8ClampedArray(outWidth * outHeight * 4)
  const sx = width / outWidth
  const sy = height / outHeight

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.min(width, Math.ceil((x + 1) * sx))
      const y0 = Math.floor(y * sy)
      const y1 = Math.min(height, Math.ceil((y + 1) * sy))
      let sum = 0
      let count = 0

      for (let sy2 = y0; sy2 < y1; sy2++) {
        for (let sx2 = x0; sx2 < x1; sx2++) {
          const i = (sy2 * width + sx2) * 4
          sum += compositeLuminanceOnWhite(data[i], data[i + 1], data[i + 2], data[i + 3])
          count++
        }
      }

      const value = sum / count <= threshold ? 0 : 255
      const di = (y * outWidth + x) * 4
      writePixel(out, di, value)
    }
  }

  return { width: outWidth, height: outHeight, data: out }
}

/**
 * @param {ImageData} imageData
 * @param {number} [blackpoint=128]
 */
export function binarizeImageData(imageData, blackpoint = 128) {
  const threshold = Math.max(0, Math.min(255, blackpoint))
  binarizeThreshold(imageData, threshold)
  return imageData
}
