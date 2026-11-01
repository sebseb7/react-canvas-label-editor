import { imageSrcForLoad } from '../utils/imageSrc.js'

function base64ToUint8Array(base64) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64')
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesFromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) {
    return base64ToUint8Array(dataUrl)
  }
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (meta.includes(';base64')) {
    return base64ToUint8Array(payload)
  }
  const str = decodeURIComponent(payload)
  return new TextEncoder().encode(str)
}

export async function loadSourceImage(src, hostCanvas) {
  if (!src?.trim()) {
    throw new Error('Empty image source')
  }

  const dataUrl = imageSrcForLoad(src)
  const bytes = bytesFromDataUrl(dataUrl)
  return hostCanvas.decodeImage(bytes)
}
