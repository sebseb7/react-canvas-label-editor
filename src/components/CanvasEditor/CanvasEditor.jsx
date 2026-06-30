import { Component, createRef } from 'react'
import { drawTextbox as renderTextboxContent } from '../../utils/drawTextbox'
import { ensureEditorFontsLoaded } from '../../utils/textboxFonts'
import { imageSrcForLoad } from '../../utils/imageSrc'
import { oneBitCacheKey, render1BitCanvas } from '../../utils/image1bit'
import { renderBarcode } from '../../utils/barcode'
import EditorPanel from './EditorPanel'
import {
  createResizeDrag,
  findResizeHandleHit,
  getObjectBounds,
  hitTest,
  resizePatchForObject,
  RESIZE_HANDLE_SIZE,
} from './geometry'
import {
  CANVAS_HEIGHT_MAX,
  CANVAS_HEIGHT_MIN,
  CANVAS_HEIGHT_DEFAULT,
  CANVAS_WIDTH,
  PNG_SCALE_MIN,
} from './constants'
import { createBarcode, createPng, createTextbox } from './types'
import './CanvasEditor.css'

export default class CanvasEditor extends Component {
  canvasRef = createRef()
  imageCache = new Map()
  oneBitCache = new Map()
  fittedPngKeys = new Set()

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
    height: CANVAS_HEIGHT_DEFAULT,
    objects: [],
    onChange: null,
    onHeightChange: null,
  }

  componentDidMount() {
    ensureEditorFontsLoaded().then(() => this.redraw())
    window.addEventListener('mousemove', this.onWindowMouseMove)
    window.addEventListener('mouseup', this.onWindowMouseUp)
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
      prevState.selectedId !== this.state.selectedId
    ) {
      this.redraw()
    }
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.onWindowMouseMove)
    window.removeEventListener('mouseup', this.onWindowMouseUp)
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
    const obj = factory()
    this.updateObjects([...this.props.objects, obj])
    this.setState({ selectedId: obj.id })
  }

  canvasPoint(event) {
    const canvas = this.canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  onCanvasMouseDown = (event) => {
    const { x, y } = this.canvasPoint(event)
    const { objects } = this.props
    const { selectedId } = this.state

    const resizeId = findResizeHandleHit(objects, x, y, this.imageCache, selectedId)
    if (resizeId) {
      const obj = objects.find((o) => o.id === resizeId)
      this.bringToFront(resizeId)
      this.setState({
        selectedId: resizeId,
        drag: createResizeDrag(obj, this.imageCache, x, y),
      })
      return
    }

    const hitId = hitTest(objects, x, y, this.imageCache)
    if (hitId) {
      const obj = objects.find((o) => o.id === hitId)
      this.bringToFront(hitId)
      this.setState({
        selectedId: hitId,
        drag: {
          mode: 'move',
          id: hitId,
          startX: x,
          startY: y,
          origX: obj.x,
          origY: obj.y,
        },
      })
      return
    }

    this.setState({ selectedId: null })
  }

  onCanvasMouseMove = (event) => {
    if (this.state.drag) return
    const canvas = this.canvasRef.current
    const { x, y } = this.canvasPoint(event)
    const resizeId = findResizeHandleHit(
      this.props.objects,
      x,
      y,
      this.imageCache,
      this.state.selectedId,
    )
    canvas.style.cursor = resizeId ? 'nwse-resize' : 'default'
  }

  onWindowMouseMove = (event) => {
    const { drag } = this.state
    if (!drag) return
    const { x, y } = this.canvasPoint(event)
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
    if (this.state.drag) {
      this.setState({ drag: null })
    }
  }

  redraw() {
    const canvas = this.canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = CANVAS_WIDTH
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
          ctx.save()
          ctx.strokeStyle = '#2563eb'
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4)

          const hx = bounds.x + bounds.w
          const hy = bounds.y + bounds.h
          const hs = RESIZE_HANDLE_SIZE / 2
          ctx.fillStyle = '#2563eb'
          ctx.fillRect(hx - hs, hy - hs, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          ctx.strokeRect(hx - hs, hy - hs, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE)

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
    ctx.save()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h)
    ctx.setLineDash([])
    renderTextboxContent(ctx, obj, { fillStyle: '#0f172a' })
    ctx.restore()
  }

  drawBarcode(ctx, obj) {
    const { canvas } = renderBarcode(obj)
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
      ctx.fillText('PNG', obj.x + 8, obj.y + size / 2)
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
    const width = CANVAS_WIDTH
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
    const height = this.canvasHeight()

    return (
      <div className="canvas-editor">
        <div className="canvas-editor__toolbar">
          <button type="button" className="canvas-editor-btn" onClick={() => this.addObject(createTextbox)}>
            + Textfeld
          </button>
          <button type="button" className="canvas-editor-btn" onClick={() => this.addObject(createBarcode)}>
            + Barcode
          </button>
          <button type="button" className="canvas-editor-btn" onClick={() => this.addObject(createPng)}>
            + PNG
          </button>
          <label className="canvas-editor__height">
            <span>Höhe {height}</span>
            <input
              type="range"
              min={CANVAS_HEIGHT_MIN}
              max={CANVAS_HEIGHT_MAX}
              value={height}
              onChange={(e) => this.setCanvasHeight(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="canvas-editor__body">
          <div className="canvas-editor__stage">
            <canvas
              ref={this.canvasRef}
              className="canvas-editor__canvas"
              width={CANVAS_WIDTH}
              height={height}
              onMouseDown={this.onCanvasMouseDown}
              onMouseMove={this.onCanvasMouseMove}
            />
          </div>
          <EditorPanel
            selected={this.getSelected()}
            onUpdate={(id, patch) => this.updateObject(id, patch)}
            onDelete={(id) => this.deleteObject(id)}
          />
        </div>
      </div>
    )
  }
}
