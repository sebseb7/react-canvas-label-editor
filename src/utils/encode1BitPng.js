/**
 * Encode an already-binarized canvas/ImageData as a compressed indexed PNG.
 *
 * Canvas `toDataURL('image/png')` stores full RGBA. This packs to a 3-color
 * palette (transparent / black / white) and zlib-compresses the IDAT stream,
 * which is typically an order of magnitude smaller for 1-bit label art.
 */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u32be(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ])
}

function concatBytes(parts) {
  let length = 0
  for (const part of parts) length += part.length
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function pngChunk(type, data) {
  const typeBytes = new Uint8Array(4)
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i)
  const body = concatBytes([typeBytes, data])
  return concatBytes([u32be(data.length), body, u32be(crc32(body))])
}

function getImageData(source) {
  if (source instanceof ImageData) return source
  const width = source.width
  const height = source.height
  const ctx =
    typeof source.getContext === 'function'
      ? source.getContext('2d', { willReadFrequently: true })
      : null
  if (!ctx) {
    throw new Error('encode1BitPng expects a canvas or ImageData')
  }
  return ctx.getImageData(0, 0, width, height)
}

/**
 * Pack binarized RGBA into PNG filter-None scanlines, 2-bit indexed:
 * 0 = transparent, 1 = black, 2 = white.
 */
function packIndexedScanlines(imageData) {
  const { data, width, height } = imageData
  const rowBytes = 1 + Math.ceil((width * 2) / 8)
  const raw = new Uint8Array(rowBytes * height)

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes
    raw[rowStart] = 0 // filter None
    let bitPos = 0
    let acc = 0
    let out = rowStart + 1

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      let index = 0 // transparent
      if (a >= 128) {
        index = data[i] < 128 ? 1 : 2 // black : white
      }
      acc = (acc << 2) | index
      bitPos += 2
      if (bitPos === 8) {
        raw[out++] = acc
        acc = 0
        bitPos = 0
      }
    }
    if (bitPos > 0) {
      raw[out] = acc << (8 - bitPos)
    }
  }

  return raw
}

async function zlibCompress(bytes) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream unavailable')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

function bytesToBase64(bytes) {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * @param {HTMLCanvasElement | OffscreenCanvas | ImageData} source
 * @returns {Promise<string>} `data:image/png;base64,...`
 */
export async function encode1BitPngDataUrl(source) {
  const imageData = getImageData(source)
  const { width, height } = imageData
  const scanlines = packIndexedScanlines(imageData)
  const compressed = await zlibCompress(scanlines)

  // bitDepth 2, colorType 3 (indexed), compression 0, filter 0, interlace 0
  const ihdr = new Uint8Array(13)
  ihdr.set(u32be(width), 0)
  ihdr.set(u32be(height), 4)
  ihdr[8] = 2
  ihdr[9] = 3
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Palette: transparent placeholder RGB, black, white (alpha via tRNS)
  const plte = new Uint8Array([
    0, 0, 0,
    0, 0, 0,
    255, 255, 255,
  ])
  const trns = new Uint8Array([0, 255, 255])

  const png = concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('tRNS', trns),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array(0)),
  ])

  return `data:image/png;base64,${bytesToBase64(png)}`
}

/** Sync fallback when CompressionStream is missing (RGBA PNG, larger). */
export function encode1BitPngDataUrlFallback(source) {
  if (source instanceof ImageData) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    canvas.getContext('2d').putImageData(source, 0, 0)
    return canvas.toDataURL('image/png')
  }
  return source.toDataURL('image/png')
}
