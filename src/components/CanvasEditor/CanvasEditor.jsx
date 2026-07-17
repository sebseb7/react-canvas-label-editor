import { Component, createRef } from 'react'
import { drawTextboxContent } from '../../utils/drawTextbox'
import { ensureEditorFontsLoaded } from '../../utils/textboxFonts'
import { imageSrcForLoad } from '../../utils/imageSrc'
import { oneBitCacheKey, render1BitCanvas } from '../../utils/image1bit'
import { renderBarcode } from '../../utils/barcode'
import EditorPanel from './EditorPanel'
import {
  clampObjectToCanvas,
  createResizeDrag,
  createRotateDrag,
  findHandleHit,
  getObjectBounds,
  getResizeHandleBounds,
  getRotateHandleBounds,
  hitTest,
  resizePatchForObject,
  rotationFromPointer,
  ROTATE_HANDLE_SIZE,
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

export default class CanvasEditor extends Component {
  canvasRef = createRef()
  imageCache = new Map()
  oneBitCache = new Map()
  fittedPngKeys = new Set()
  touchMoveBound = false
  /** Synchronous drag pointer so touchmove works before setState flushes. */
  activeDrag = null

  state = {
    selectedId: null,
    drag: null,
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
      }
    }

    if (
      prevProps.objects !== this.props.objects ||
      prevProps.height !== this.props.height ||
      prevState.internalHeight !== this.state.internalHeight ||
      prevState.selectedId !== this.state.selectedId ||
      prevState.drag !== this.state.drag
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
    this.updateObjects(
      this.props.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
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

  onCanvasMouseDown = (event) => {
    if (event.touches) event.preventDefault()
    const { x, y } = this.canvasPoint(event)
    const { objects } = this.props
    const { selectedId } = this.state

    const handleHit = findHandleHit(objects, x, y, this.imageCache, selectedId)
    if (handleHit) {
      const obj = objects.find((o) => o.id === handleHit.id)
      this.bringToFront(handleHit.id)
      this.setState({ selectedId: handleHit.id })
      this.setDrag(
        handleHit.mode === 'rotate'
          ? createRotateDrag(obj)
          : createResizeDrag(obj, this.imageCache, x, y),
      )
      return
    }

    const hitId = hitTest(objects, x, y, this.imageCache)
    if (hitId) {
      const obj = objects.find((o) => o.id === hitId)
      this.bringToFront(hitId)
      this.setState({ selectedId: hitId })
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
    )
    if (handleHit?.mode === 'rotate') {
      canvas.style.cursor = 'grab'
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
    const { selectedId } = this.state

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    for (const obj of objects) {
      if (obj.id === selectedId) continue
      this.drawObject(ctx, obj)
    }

    const selected = selectedId ? objects.find((o) => o.id === selectedId) : null
    if (selected) {
      this.drawObject(ctx, selected)
    }

    if (selected) {
      const bounds = getObjectBounds(selected, this.imageCache)
      if (bounds) {
        const drawChrome = () => {
          ctx.strokeStyle = '#2563eb'
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4)

          const resize = getResizeHandleBounds(selected, this.imageCache)
          if (resize) {
            ctx.fillStyle = '#2563eb'
            ctx.fillRect(resize.x, resize.y, resize.w, resize.h)
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1
            ctx.strokeRect(resize.x, resize.y, resize.w, resize.h)
          }

          if (selected.type === 'textbox') {
            const rotate = getRotateHandleBounds(selected)
            if (rotate) {
              const stemX = bounds.x + bounds.w / 2
              const stemTop = bounds.y
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

        ctx.save()
        if (selected.type === 'textbox') {
          withTextboxRotation(ctx, selected, drawChrome)
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
      ctx.save()
      const size = 48 * obj.scale
      ctx.strokeStyle = '#cbd5e1'
      ctx.strokeRect(obj.x, obj.y, size, size)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '12px sans-serif'
      ctx.fillText('Image', obj.x + 8, obj.y + size / 2)
      ctx.restore()
      return
    }

    const source = this.loadSourceImage(obj.src)
    if (!source?.complete || !source.naturalWidth) return

    this.fitPngToCanvas(obj, source)

    const blackpoint = obj.blackpoint ?? 128
    const displayW = source.naturalWidth * obj.scale
    const displayH = source.naturalHeight * obj.scale
    const processed = this.get1BitImage(obj.src, source, blackpoint, displayW, displayH)
    ctx.drawImage(processed, obj.x, obj.y, displayW, displayH)
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
      this.updateObject(obj.id, { scale: newScale })
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
            selected={this.getSelected()}
            onUpdate={(id, patch) => this.updateObject(id, patch)}
            onDelete={(id) => this.deleteObject(id)}
            onCopy={(obj) => this.props.onCopy?.(obj)}
            clipboard={this.props.clipboard}
            onPaste={(clipboard) => this.pasteObject(clipboard)}
            components={components}
            labels={labels}
          />
        </div>
      </div>
    )
  }
}
