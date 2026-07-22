import { Component, createRef } from 'react'
import { drawTextboxContent } from '../../utils/drawTextbox'
import { ensureEditorFontsLoaded } from '../../utils/textboxFonts'
import { imageSrcForLoad, imageSrcForStore } from '../../utils/imageSrc'
import { oneBitCacheKey, pngRenderedKey, render1BitCanvas } from '../../utils/image1bit'
import {
  encode1BitPngDataUrl,
  encode1BitPngDataUrlFallback,
} from '../../utils/encode1BitPng'
import { renderBarcode } from '../../utils/barcode'
import EditorPanel from './EditorPanel'
import {
  bakePngCrop,
  clampObjectToCanvas,
  createCropDrag,
  createResizeDrag,
  createRotateDrag,
  cropInsetsFromDrag,
  findHandleHit,
  getCropHandleBounds,
  getObjectBounds,
  getPngBounds,
  getResizeHandleBounds,
  getRotateHandleBounds,
  hitTest,
  objectSupportsRotation,
  resizePatchForObject,
  rotationFromPointer,
  ROTATE_HANDLE_SIZE,
  withBoundsRotation,
  withTextboxRotation,
} from './geometry'
import {
  CANVAS_HEIGHT_MAX,
  CANVAS_HEIGHT_MIN,
  CANVAS_HEIGHT_DEFAULT,
  CANVAS_WIDTH,
  PNG_SCALE_MIN,
} from './constants'
import { createBarcode, createPng, createTextbox } from './types'
import { createId } from '../../utils/createId'
import { DEFAULT_COMPONENTS } from './defaultComponents'
import { DEFAULT_LABELS, mergeLabels } from './defaultLabels'
import './CanvasEditor.css'

const EMPTY_CROP_INSETS = { left: 0, top: 0, right: 0, bottom: 0 }

export default class CanvasEditor extends Component {
  canvasRef = createRef()
  imageCache = new Map()
  oneBitCache = new Map()
  fittedPngKeys = new Set()
  /** @type {Map<string, string>} id → fingerprint of last written `rendered` */
  renderedKeys = new Map()
  touchMoveBound = false
  /** Synchronous drag pointer so touchmove works before setState flushes. */
  activeDrag = null
  /** Avoid re-entrant rendered writes while a patch is flushing. */
  renderedWritePending = new Set()

  state = {
    selectedId: null,
    drag: null,
    cropModeId: null,
    cropInsets: { ...EMPTY_CROP_INSETS },
    internalHeight: CANVAS_HEIGHT_DEFAULT,
  }

  canvasHeight() {
    return this.props.onHeightChange
      ? this.props.height
      : this.state.internalHeight
  }

  setCanvasHeight(height) {
    if (this.props.onHeightChange) {
      this.props.onHeightChange(height)
    } else {
      this.setState({ internalHeight: height })
    }
  }

  static defaultProps = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT_DEFAULT,
    minHeight: CANVAS_HEIGHT_MIN,
    maxHeight: CANVAS_HEIGHT_MAX,
    objects: [],
    onChange: null,
    onHeightChange: null,
    onCopy: null,
    clipboard: null,
    components: {},
    labels: {},
  }

  getComponents() {
    return { ...DEFAULT_COMPONENTS, ...this.props.components }
  }

  getLabels() {
    return mergeLabels(DEFAULT_LABELS, this.props.labels)
  }

  componentDidMount() {
    ensureEditorFontsLoaded().then(() => this.redraw())
    window.addEventListener('mousemove', this.onWindowMouseMove)
    window.addEventListener('mouseup', this.onWindowMouseUp)
    window.addEventListener('touchend', this.onWindowMouseUp)
    window.addEventListener('touchcancel', this.onWindowMouseUp)
  }

  componentDidUpdate(prevProps, prevState) {
    for (const obj of this.props.objects) {
      if (obj.type !== 'png') continue
      const prev = prevProps.objects.find((o) => o.id === obj.id)
      if (prev && prev.src !== obj.src) {
        this.fittedPngKeys.delete(`${obj.id}:${prev.src}`)
        this.fittedPngKeys.delete(`${obj.id}:${obj.src}`)
        this.imageCache.delete(prev.src)
        this.renderedKeys.delete(obj.id)
        if (this.state.cropModeId === obj.id) {
          this.setState({ cropInsets: { ...EMPTY_CROP_INSETS } })
        }
      } else if (
        prev &&
        (prev.scale !== obj.scale || prev.blackpoint !== obj.blackpoint)
      ) {
        this.renderedKeys.delete(obj.id)
      }
    }

    if (
      this.state.cropModeId &&
      !this.props.objects.some((o) => o.id === this.state.cropModeId && o.type === 'png')
    ) {
      this.exitCropMode({ bake: false })
    }

    if (
      prevProps.objects !== this.props.objects ||
      prevProps.height !== this.props.height ||
      prevState.internalHeight !== this.state.internalHeight ||
      prevState.selectedId !== this.state.selectedId ||
      prevState.drag !== this.state.drag ||
      prevState.cropModeId !== this.state.cropModeId ||
      prevState.cropInsets !== this.state.cropInsets
    ) {
      this.redraw()
    }
  }

  componentWillUnmount() {
    this.syncTouchMoveListener(false)
    window.removeEventListener('mousemove', this.onWindowMouseMove)
    window.removeEventListener('mouseup', this.onWindowMouseUp)
    window.removeEventListener('touchend', this.onWindowMouseUp)
    window.removeEventListener('touchcancel', this.onWindowMouseUp)
  }

  /** Only listen for non-passive touchmove while dragging (avoids blocking taps on Android). */
  syncTouchMoveListener(active) {
    if (active && !this.touchMoveBound) {
      window.addEventListener('touchmove', this.onWindowMouseMove, { passive: false })
      this.touchMoveBound = true
    } else if (!active && this.touchMoveBound) {
      window.removeEventListener('touchmove', this.onWindowMouseMove)
      this.touchMoveBound = false
    }
  }

  getSelected() {
    return this.props.objects.find((o) => o.id === this.state.selectedId) ?? null
  }

  updateObjects(objects) {
    this.props.onChange?.(objects)
  }

  updateObject(id, patch) {
    const current = this.props.objects.find((o) => o.id === id)
    if (!current) return

    let nextPatch = patch
    if (current.type === 'png') {
      const srcChanging = Object.prototype.hasOwnProperty.call(patch, 'src')
      const paramsChanging =
        Object.prototype.hasOwnProperty.call(patch, 'scale') ||
        Object.prototype.hasOwnProperty.call(patch, 'blackpoint')
      if (!Object.prototype.hasOwnProperty.call(patch, 'rendered')) {
        if (srcChanging) {
          // Source replaced — drop stale blit until the editor rebuilds it.
          nextPatch = { ...patch, rendered: '' }
          this.renderedKeys.delete(id)
        } else if (paramsChanging) {
          // Keep previous rendered for preview until the new 1-bit is ready.
          this.renderedKeys.delete(id)
        }
      }
    }

    // Skip no-op patches (rotate-drag often repeats the same 90° snap).
    if (Object.keys(nextPatch).every((key) => Object.is(current[key], nextPatch[key]))) {
      return
    }
    this.updateObjects(
      this.props.objects.map((o) => (o.id === id ? { ...o, ...nextPatch } : o)),
    )
  }

  bringToFront(id) {
    const { objects } = this.props
    const index = objects.findIndex((o) => o.id === id)
    if (index === -1 || index === objects.length - 1) return
    const next = [...objects]
    const [obj] = next.splice(index, 1)
    next.push(obj)
    this.updateObjects(next)
  }

  deleteObject(id) {
    if (this.state.cropModeId === id) {
      this.exitCropMode({ bake: false })
    }
    this.updateObjects(this.props.objects.filter((o) => o.id !== id))
    if (this.state.selectedId === id) {
      this.setState({ selectedId: null })
    }
  }

  addObject(factory) {
    const obj = clampObjectToCanvas(
      factory(),
      this.props.width,
      this.canvasHeight(),
      this.imageCache,
    )
    this.updateObjects([...this.props.objects, obj])
    this.setState({ selectedId: obj.id })
  }

  pasteObject(clipboard) {
    if (!clipboard) return
    const obj = clampObjectToCanvas(
      {
        ...clipboard,
        id: createId(),
        x: (clipboard.x ?? 0) + 20,
        y: (clipboard.y ?? 0) + 20,
      },
      this.props.width,
      this.canvasHeight(),
      this.imageCache,
    )
    this.updateObjects([...this.props.objects, obj])
    this.setState({ selectedId: obj.id })
  }

  canvasPoint(event) {
    const canvas = this.canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const point = event.touches?.[0] ?? event.changedTouches?.[0] ?? event
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    }
  }

  setDrag(drag) {
    this.activeDrag = drag
    this.syncTouchMoveListener(Boolean(drag))
    this.setState({ drag })
  }

  handleOptions() {
    return {
      cropModeId: this.state.cropModeId,
      cropInsets: this.state.cropInsets,
    }
  }

  enterCropMode(id) {
    this.setState({
      cropModeId: id,
      cropInsets: { ...EMPTY_CROP_INSETS },
      selectedId: id,
    })
  }

  exitCropMode({ bake = true } = {}) {
    const { cropModeId, cropInsets } = this.state
    if (!cropModeId) return

    if (bake) {
      const obj = this.props.objects.find((o) => o.id === cropModeId)
      if (obj?.type === 'png' && obj.src) {
        const source = this.imageCache.get(obj.src)
        if (source?.complete && source.naturalWidth) {
          const patch = bakePngCrop(obj, source, cropInsets)
          if (patch) {
            this.updateObject(cropModeId, {
              src: imageSrcForStore(patch.src),
              x: patch.x,
              y: patch.y,
            })
          }
        }
      }
    }

    this.setState({
      cropModeId: null,
      cropInsets: { ...EMPTY_CROP_INSETS },
    })
  }

  toggleCropMode = () => {
    const selected = this.getSelected()
    if (!selected || selected.type !== 'png') return
    if (this.state.cropModeId === selected.id) {
      this.exitCropMode({ bake: true })
    } else {
      this.enterCropMode(selected.id)
    }
  }

  /**
   * Replace `src` with the current 1-bit preview PNG and reset scale to 1.
   * Works for both SVG and raster sources — the live/preview bitmap becomes the asset.
   */
  optimizePng = async () => {
    const selected = this.getSelected()
    if (!selected || selected.type !== 'png' || !selected.src?.trim()) return

    if (this.state.cropModeId === selected.id) {
      this.exitCropMode({ bake: true })
    }

    const applyOptimized = (dataUrl, pixelW, pixelH) => {
      const src = imageSrcForStore(dataUrl)
      const blackpoint = selected.blackpoint ?? 128
      this.fittedPngKeys.delete(`${selected.id}:${selected.src}`)
      this.fittedPngKeys.delete(`${selected.id}:${src}`)
      this.renderedKeys.set(selected.id, `${src}::${blackpoint}::1::${pixelW}x${pixelH}`)
      this.updateObject(selected.id, {
        src,
        scale: 1,
        rendered: dataUrl,
      })
    }

    // Prefer the already-encoded preview blit when present.
    if (selected.rendered?.trim()) {
      try {
        const { width, height } = await this.probeImageSize(selected.rendered)
        applyOptimized(selected.rendered, width, height)
        return
      } catch {
        // Rebuild from source below.
      }
    }

    const source = await this.ensureSourceImage(selected.src)
    if (!source) return

    const blackpoint = selected.blackpoint ?? 128
    const displayW = source.naturalWidth * selected.scale
    const displayH = source.naturalHeight * selected.scale
    const processed = this.get1BitImage(selected.src, source, blackpoint, displayW, displayH)
    let dataUrl
    try {
      dataUrl = await encode1BitPngDataUrl(processed)
    } catch {
      dataUrl = encode1BitPngDataUrlFallback(processed)
    }
    applyOptimized(dataUrl, processed.width, processed.height)
  }

  probeImageSize(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        if (!img.naturalWidth) {
          reject(new Error('empty image'))
          return
        }
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => reject(new Error('image load failed'))
      img.src = imageSrcForLoad(src)
    })
  }

  ensureSourceImage(src) {
    const existing = this.imageCache.get(src)
    if (existing?.complete && existing.naturalWidth) {
      return Promise.resolve(existing)
    }
    const img = this.loadSourceImage(src)
    if (img?.complete && img.naturalWidth) {
      return Promise.resolve(img)
    }
    return new Promise((resolve) => {
      if (!img) {
        resolve(null)
        return
      }
      img.addEventListener(
        'load',
        () => resolve(img.naturalWidth ? img : null),
        { once: true },
      )
      img.addEventListener('error', () => resolve(null), { once: true })
    })
  }

  onCanvasMouseDown = (event) => {
    if (event.touches) event.preventDefault()
    const { x, y } = this.canvasPoint(event)
    const { objects } = this.props
    const { selectedId, cropModeId } = this.state

    const handleHit = findHandleHit(
      objects,
      x,
      y,
      this.imageCache,
      selectedId,
      this.handleOptions(),
    )
    if (handleHit) {
      const obj = objects.find((o) => o.id === handleHit.id)
      this.bringToFront(handleHit.id)
      this.setState({ selectedId: handleHit.id })
      if (handleHit.mode === 'rotate') {
        this.setDrag(createRotateDrag(obj, this.imageCache))
      } else if (handleHit.mode === 'crop') {
        this.setDrag(
          createCropDrag(obj, this.imageCache, handleHit.side, x, y, this.state.cropInsets),
        )
      } else {
        this.setDrag(createResizeDrag(obj, this.imageCache, x, y))
      }
      return
    }

    const hitId = hitTest(objects, x, y, this.imageCache)
    if (hitId) {
      if (cropModeId && hitId !== cropModeId) {
        this.exitCropMode({ bake: true })
      }
      const obj = objects.find((o) => o.id === hitId)
      this.bringToFront(hitId)
      this.setState({ selectedId: hitId })
      // In crop mode, clicking the image selects it but does not move it.
      if (cropModeId === hitId) {
        this.setDrag(null)
        return
      }
      this.setDrag({
        mode: 'move',
        id: hitId,
        startX: x,
        startY: y,
        origX: obj.x,
        origY: obj.y,
      })
      return
    }

    if (cropModeId) {
      this.exitCropMode({ bake: true })
    }
    this.setDrag(null)
    this.setState({ selectedId: null })
  }

  onCanvasMouseMove = (event) => {
    if (this.activeDrag || this.state.drag) return
    const canvas = this.canvasRef.current
    const { x, y } = this.canvasPoint(event)
    const handleHit = findHandleHit(
      this.props.objects,
      x,
      y,
      this.imageCache,
      this.state.selectedId,
      this.handleOptions(),
    )
    if (handleHit?.mode === 'rotate') {
      canvas.style.cursor = 'grab'
    } else if (handleHit?.mode === 'crop') {
      canvas.style.cursor =
        handleHit.side === 'left' || handleHit.side === 'right' ? 'ew-resize' : 'ns-resize'
    } else if (handleHit?.mode === 'resize') {
      canvas.style.cursor = 'nwse-resize'
    } else {
      canvas.style.cursor = 'default'
    }
  }

  onWindowMouseMove = (event) => {
    const drag = this.activeDrag
    if (!drag) return
    if (event.touches) event.preventDefault()
    const { x, y } = this.canvasPoint(event)

    if (drag.mode === 'rotate') {
      this.updateObject(drag.id, {
        rotation: rotationFromPointer(drag.cx, drag.cy, x, y),
      })
      return
    }

    if (drag.mode === 'crop') {
      const obj = this.props.objects.find((o) => o.id === drag.id)
      const dx = x - drag.startX
      const dy = y - drag.startY
      this.setState({
        cropInsets: cropInsetsFromDrag(drag, dx, dy, obj?.rotation ?? 0),
      })
      return
    }

    const dx = x - drag.startX
    const dy = y - drag.startY

    if (drag.mode === 'resize') {
      const obj = this.props.objects.find((o) => o.id === drag.id)
      if (obj) {
        this.updateObject(drag.id, resizePatchForObject(obj, drag, dx, dy))
      }
      return
    }

    this.updateObject(drag.id, {
      x: Math.round(drag.origX + dx),
      y: Math.round(drag.origY + dy),
    })
  }

  onWindowMouseUp = () => {
    if (this.activeDrag || this.state.drag) {
      this.setDrag(null)
    }
  }

  redraw() {
    const canvas = this.canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = this.props.width
    const height = this.canvasHeight()
    const { objects } = this.props
    const { selectedId, cropModeId, cropInsets } = this.state

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    for (const obj of objects) {
      if (obj.id === selectedId) continue
      this.drawObject(ctx, obj)
    }

    const selected = selectedId ? objects.find((o) => o.id === selectedId) : null
    if (selected) {
      // Keep drawing the full image while cropping; chrome dims the discarded edges.
      this.drawObject(ctx, selected)
    }

    if (selected) {
      const inCrop = cropModeId === selected.id && selected.type === 'png'
      const fullBounds = getObjectBounds(selected, this.imageCache)
      const cropBounds = inCrop
        ? getPngBounds(selected, this.imageCache, cropInsets)
        : fullBounds
      if (fullBounds && cropBounds) {
        const drawChrome = () => {
          if (inCrop) {
            ctx.save()
            ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'
            ctx.fillRect(fullBounds.x, fullBounds.y, fullBounds.w, cropInsets.top)
            ctx.fillRect(
              fullBounds.x,
              fullBounds.y + fullBounds.h - cropInsets.bottom,
              fullBounds.w,
              cropInsets.bottom,
            )
            ctx.fillRect(
              fullBounds.x,
              fullBounds.y + cropInsets.top,
              cropInsets.left,
              fullBounds.h - cropInsets.top - cropInsets.bottom,
            )
            ctx.fillRect(
              fullBounds.x + fullBounds.w - cropInsets.right,
              fullBounds.y + cropInsets.top,
              cropInsets.right,
              fullBounds.h - cropInsets.top - cropInsets.bottom,
            )
            ctx.restore()
          }

          ctx.strokeStyle = '#2563eb'
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.strokeRect(cropBounds.x - 2, cropBounds.y - 2, cropBounds.w + 4, cropBounds.h + 4)

          if (inCrop) {
            const handles = getCropHandleBounds(selected, this.imageCache, cropInsets)
            if (handles) {
              for (const side of ['left', 'right', 'top', 'bottom']) {
                const handle = handles[side]
                ctx.fillStyle = '#2563eb'
                ctx.fillRect(handle.x, handle.y, handle.w, handle.h)
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 1
                ctx.strokeRect(handle.x, handle.y, handle.w, handle.h)
              }
            }
          } else {
            const resize = getResizeHandleBounds(selected, this.imageCache)
            if (resize) {
              ctx.fillStyle = '#2563eb'
              ctx.fillRect(resize.x, resize.y, resize.w, resize.h)
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 1
              ctx.strokeRect(resize.x, resize.y, resize.w, resize.h)
            }

            if (objectSupportsRotation(selected)) {
              const rotate = getRotateHandleBounds(selected, this.imageCache)
              if (rotate) {
                const stemX = fullBounds.x + fullBounds.w / 2
                const stemTop = fullBounds.y
                const handleCx = rotate.x + rotate.w / 2
                const handleCy = rotate.y + rotate.h / 2
                ctx.beginPath()
                ctx.moveTo(stemX, stemTop)
                ctx.lineTo(handleCx, handleCy)
                ctx.strokeStyle = '#2563eb'
                ctx.lineWidth = 1.5
                ctx.stroke()

                ctx.beginPath()
                ctx.arc(handleCx, handleCy, ROTATE_HANDLE_SIZE / 2, 0, Math.PI * 2)
                ctx.fillStyle = '#2563eb'
                ctx.fill()
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 1
                ctx.stroke()
              }
            }
          }
        }

        ctx.save()
        if (objectSupportsRotation(selected)) {
          withBoundsRotation(ctx, fullBounds, selected.rotation, drawChrome)
        } else {
          drawChrome()
        }
        ctx.restore()
      }
    }
  }

  drawObject(ctx, obj) {
    switch (obj.type) {
      case 'textbox':
        this.drawTextbox(ctx, obj)
        break
      case 'barcode':
        this.drawBarcode(ctx, obj)
        break
      case 'png':
        this.drawPng(ctx, obj)
        break
      default:
        break
    }
  }

  drawTextbox(ctx, obj) {
    withTextboxRotation(ctx, obj, () => {
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h)
      ctx.setLineDash([])
      drawTextboxContent(ctx, obj, { fillStyle: '#0f172a' })
    })
  }

  drawBarcode(ctx, obj) {
    const { canvas } = renderBarcode(obj, this.getLabels().barcode.invalidCode)
    ctx.drawImage(canvas, obj.x, obj.y)
  }

  drawPng(ctx, obj) {
    if (!obj.src) {
      if (obj.rendered) {
        this.queueRenderedClear(obj.id)
      }
      const size = 48 * obj.scale
      const bounds = { x: obj.x, y: obj.y, w: size, h: size }
      withBoundsRotation(ctx, bounds, obj.rotation, () => {
        ctx.strokeStyle = '#cbd5e1'
        ctx.strokeRect(obj.x, obj.y, size, size)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '12px sans-serif'
        ctx.fillText('Image', obj.x + 8, obj.y + size / 2)
      })
      return
    }

    const source = this.loadSourceImage(obj.src)
    if (!source?.complete || !source.naturalWidth) return

    this.fitPngToCanvas(obj, source)

    const blackpoint = obj.blackpoint ?? 128
    const displayW = source.naturalWidth * obj.scale
    const displayH = source.naturalHeight * obj.scale
    const processed = this.get1BitImage(obj.src, source, blackpoint, displayW, displayH)
    this.ensurePngRendered(obj, processed)
    const bounds = { x: obj.x, y: obj.y, w: displayW, h: displayH }

    withBoundsRotation(ctx, bounds, obj.rotation, () => {
      ctx.drawImage(processed, obj.x, obj.y, displayW, displayH)
    })
  }

  queueRenderedClear(id) {
    if (this.renderedWritePending.has(id)) return
    this.renderedKeys.delete(id)
    this.renderedWritePending.add(id)
    queueMicrotask(() => {
      this.renderedWritePending.delete(id)
      const current = this.props.objects.find((o) => o.id === id)
      if (current?.type === 'png' && current.rendered) {
        this.updateObject(id, { rendered: '' })
      }
    })
  }

  /**
   * Persist the final-scale 1-bit PNG on the object so the server can blit it
   * without re-rasterizing `src`. Skipped while dragging (scale/crop) — flushed
   * on the next idle redraw after mouseup.
   */
  ensurePngRendered(obj, processedCanvas) {
    if (!obj?.id || obj.type !== 'png') return
    if (this.activeDrag?.id === obj.id) return
    if (this.renderedWritePending.has(obj.id)) return

    const key = pngRenderedKey(obj, processedCanvas.width, processedCanvas.height)
    if (this.renderedKeys.get(obj.id) === key) return

    this.renderedKeys.set(obj.id, key)
    this.renderedWritePending.add(obj.id)

    const write = (rendered) => {
      this.renderedWritePending.delete(obj.id)
      const current = this.props.objects.find((o) => o.id === obj.id)
      if (!current || current.type !== 'png') return
      const nextKey = pngRenderedKey(
        current,
        processedCanvas.width,
        processedCanvas.height,
      )
      if (this.renderedKeys.get(obj.id) !== nextKey) return
      if (current.rendered === rendered) return
      this.updateObject(obj.id, { rendered })
    }

    encode1BitPngDataUrl(processedCanvas).then(write, () => {
      write(encode1BitPngDataUrlFallback(processedCanvas))
    })
  }

  loadSourceImage(src) {
    let img = this.imageCache.get(src)
    if (!img) {
      img = new Image()
      img.src = imageSrcForLoad(src)
      img.onload = () => {
        this.oneBitCache.clear()
        for (const obj of this.props.objects) {
          if (obj.type === 'png' && obj.src === src) {
            this.fitPngToCanvas(obj, img)
          }
        }
        this.redraw()
      }
      this.imageCache.set(src, img)
    }
    return img
  }

  fitPngToCanvas(obj, sourceImage) {
    const width = this.props.width
    const height = this.canvasHeight()
    const fitKey = `${obj.id}:${obj.src}`
    if (this.fittedPngKeys.has(fitKey)) return

    const displayW = sourceImage.naturalWidth * obj.scale
    const displayH = sourceImage.naturalHeight * obj.scale
    if (displayW <= width && displayH <= height) {
      this.fittedPngKeys.add(fitKey)
      return
    }

    const fitScale = Math.min(
      obj.scale,
      width / sourceImage.naturalWidth,
      height / sourceImage.naturalHeight,
    )
    const newScale = Math.max(PNG_SCALE_MIN, Math.round(fitScale * 1000) / 1000)
    this.fittedPngKeys.add(fitKey)
    if (newScale < obj.scale) {
      // Defer out of componentDidUpdate → redraw to avoid nested updates.
      queueMicrotask(() => this.updateObject(obj.id, { scale: newScale }))
    }
  }

  get1BitImage(srcKey, sourceImage, blackpoint, displayW, displayH) {
    const w = Math.max(1, Math.round(displayW))
    const h = Math.max(1, Math.round(displayH))
    const key = oneBitCacheKey(srcKey, blackpoint, w, h)
    let cached = this.oneBitCache.get(key)
    if (!cached) {
      cached = render1BitCanvas(sourceImage, blackpoint, w, h)
      this.oneBitCache.set(key, cached)
    }
    return cached
  }

  render() {
    const { width, minHeight, maxHeight } = this.props
    const height = this.canvasHeight()
    const components = this.getComponents()
    const labels = this.getLabels()
    const { Button, Slider } = components
    const selected = this.getSelected()
    const cropMode = Boolean(this.state.cropModeId && this.state.cropModeId === selected?.id)

    return (
      <div className="canvas-editor">
        <div className="canvas-editor__toolbar">
          <Button
            onClick={() =>
              this.addObject(() => createTextbox({ text: labels.textbox.defaultText }))
            }
          >
            {labels.toolbar.addTextbox}
          </Button>
          <Button onClick={() => this.addObject(createBarcode)}>{labels.toolbar.addBarcode}</Button>
          <Button onClick={() => this.addObject(createPng)}>{labels.toolbar.addImage}</Button>
          <Slider
            className="canvas-editor__height"
            label={labels.toolbar.height(height)}
            min={minHeight}
            max={maxHeight}
            value={height}
            onChange={(value) => this.setCanvasHeight(value)}
          />
        </div>
        <div className="canvas-editor__body">
          <div className="canvas-editor__stage">
            <canvas
              ref={this.canvasRef}
              className="canvas-editor__canvas"
              width={width}
              height={height}
              onMouseDown={this.onCanvasMouseDown}
              onMouseMove={this.onCanvasMouseMove}
              onTouchStart={this.onCanvasMouseDown}
            />
          </div>
          <EditorPanel
            selected={selected}
            onUpdate={(id, patch) => this.updateObject(id, patch)}
            onDelete={(id) => this.deleteObject(id)}
            onCopy={(obj) => this.props.onCopy?.(obj)}
            clipboard={this.props.clipboard}
            onPaste={(clipboard) => this.pasteObject(clipboard)}
            cropMode={cropMode}
            onToggleCrop={this.toggleCropMode}
            onOptimize={this.optimizePng}
            components={components}
            labels={labels}
          />
        </div>
      </div>
    )
  }
}
