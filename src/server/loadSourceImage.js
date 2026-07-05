import { loadImage } from 'canvas'
import sharp from 'sharp'
import { ensureSvgDimensions, imageSrcForLoad, isRawSvg } from '../utils/imageSrc.js'

async function svgToImage(svg) {
  const pngBuffer = await sharp(Buffer.from(ensureSvgDimensions(svg))).png().toBuffer()
  return loadImage(pngBuffer)
}

function svgFromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (meta.includes(';base64')) {
    return Buffer.from(payload, 'base64').toString('utf8')
  }
  return decodeURIComponent(payload)
}

export async function loadSourceImage(src) {
  if (!src?.trim()) {
    throw new Error('Empty image source')
  }

  const trimmed = src.trim()
  if (isRawSvg(trimmed)) {
    return svgToImage(trimmed)
  }

  const dataUrl = imageSrcForLoad(src)
  if (dataUrl.includes('image/svg+xml')) {
    return svgToImage(svgFromDataUrl(dataUrl))
  }

  return loadImage(dataUrl)
}
