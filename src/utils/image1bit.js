import { binarizeImageData } from '../render/binarize.js'

/**
 * Convert an image to 1-bit black/white using a blackpoint threshold.
 * Rasterizes at targetWidth × targetHeight so SVGs stay sharp when scaled.
 */
export function render1BitCanvas(sourceImage, blackpoint = 128, targetWidth, targetHeight) {
  const width = Math.max(1, Math.round(targetWidth ?? sourceImage.naturalWidth))
  const height = Math.max(1, Math.round(targetHeight ?? sourceImage.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sourceImage, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  binarizeImageData(imageData, blackpoint)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function oneBitCacheKey(src, blackpoint, width, height) {
  return `${src}::${blackpoint}::${width}x${height}`
}
