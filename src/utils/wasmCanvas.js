/**
 * Creates an emulated HTML Canvas 2D wrapper around a CanvasKit Surface.
 * Emulates textBaseline, textAlign, drawImage from other wasm canvases,
 * dynamic resizing, and quote-stripping for font parser compatibility.
 */
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

  function getBaselineOffset(font) {
    if (state.textBaseline === 'alphabetic') return 0
    const size = font?.getSize() || 14
    const metrics = font?.getMetrics()
    const ascent = metrics ? -metrics.ascent : size
    const descent = metrics ? metrics.descent : 0
    const emHeight = ascent + descent || size
    const topOffset = size * (ascent / emHeight)

    if (state.textBaseline === 'top') return topOffset
    if (state.textBaseline === 'middle') return topOffset - size / 2
    if (state.textBaseline === 'bottom') return topOffset - size
    if (state.textBaseline === 'hanging') return topOffset * 0.8
    if (state.textBaseline === 'ideographic') return -descent
    return 0
  }

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

              drawY += getBaselineOffset(rawCtx.je)
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

              drawY += getBaselineOffset(rawCtx.je)
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
              if (
                typeof HTMLCanvasElement !== 'undefined' &&
                image instanceof HTMLCanvasElement
              ) {
                const c2d = image.getContext('2d')
                const imgData = c2d.getImageData(0, 0, image.width, image.height)
                const skImg = ck.MakeImage(
                  {
                    width: image.width,
                    height: image.height,
                    alphaType: ck.AlphaType.Unpremul,
                    colorType: ck.ColorType.RGBA_8888,
                    colorSpace: ck.ColorSpace.SRGB,
                  },
                  imgData.data,
                  image.width * 4,
                )
                if (skImg) {
                  const res = rawCtx.drawImage.call(rawCtx, skImg, ...args)
                  skImg.delete()
                  return res
                }
              }
              return rawCtx.drawImage.call(rawCtx, image, ...args)
            }
          }
          if (prop === 'getImageData') {
            return (sx, sy, sw, sh) => {
              const rawData = rawCtx.getImageData(sx, sy, sw, sh)
              if (typeof ImageData !== 'undefined' && !(rawData instanceof ImageData)) {
                return new ImageData(
                  new Uint8ClampedArray(rawData.data.buffer, rawData.data.byteOffset, rawData.data.byteLength),
                  rawData.width,
                  rawData.height,
                )
              }
              return rawData
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
      return typeof Buffer !== 'undefined'
        ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : bytes
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
