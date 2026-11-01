import { imageSrcForLoad } from '../utils/imageSrc.js'

function bytesFromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) {
    return Buffer.from(dataUrl, 'base64')
  }
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (meta.includes(';base64')) {
    return Buffer.from(payload, 'base64')
  }
  return Buffer.from(decodeURIComponent(payload), 'utf8')
}

export async function loadSourceImage(src, hostCanvas) {
  if (!src?.trim()) {
    throw new Error('Empty image source')
  }

  const dataUrl = imageSrcForLoad(src)
  const bytes = bytesFromDataUrl(dataUrl)
  return hostCanvas.decodeImage(bytes)
}
