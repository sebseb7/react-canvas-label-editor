import { useEffect, useRef, useState } from 'react'
import {
  CanvasEditor,
  CANVAS_HEIGHT_DEFAULT,
  CANVAS_HEIGHT_MIN,
  CANVAS_HEIGHT_MAX,
  CANVAS_WIDTH,
  CANVAS_WIDTHS,
} from 'react-canvas-label-editor'
import { createBarcode, createPng, createTextbox } from '../src/components/CanvasEditor/types.js'
import { REACT_LOGO_SVG } from './sampleImages'

const initialObjects = [
  createTextbox({
    text: 'Hello canvas editor',
    minFontSize: 14,
    maxFontSize: 36,
    x: 24,
    y: 24,
    w: 220,
    h: 72,
  }),
  createBarcode({
    x: 24,
    y: 130,
    h: 48,
    scale: 2,
    code: '4006381333931',
  }),
  createPng({
    x: 320,
    y: 24,
    scale: 2,
    src: REACT_LOGO_SVG,
    blackpoint: 224,
  }),
]

export default function DevApp() {
  const [objects, setObjects] = useState(initialObjects)
  const [width, setWidth] = useState(CANVAS_WIDTH)
  const [height, setHeight] = useState(CANVAS_HEIGHT_DEFAULT)
  const [maxHeight, setMaxHeight] = useState(CANVAS_HEIGHT_MAX)
  const [dpi, setDpi] = useState(203)
  const [previewScale, setPreviewScale] = useState(1)
  const [showWidthUI, setShowWidthUI] = useState(true)
  const [showHeightUI, setShowHeightUI] = useState(true)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [clipboard, setClipboard] = useState(null)
  const previewUrlRef = useRef(null)

  const replacePreview = (blob) => {
    const nextUrl = URL.createObjectURL(blob)
    const prevUrl = previewUrlRef.current
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
    if (prevUrl && prevUrl !== nextUrl) {
      URL.revokeObjectURL(prevUrl)
    }
  }

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ height, width, objects }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Render failed (${res.status})`)
        }
        const blob = await res.blob()
        if (!active) return
        setPreviewError(null)
        replacePreview(blob)
      } catch (err) {
        if (!active || err.name === 'AbortError') return
        setPreviewError(err.message || 'Render failed')
      }
    }, 400)

    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [height, width, objects])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  return (
    <div className="dev-app">
      <div className="dev-app__config">
        <label className="dev-app__config-item">
          <input
            type="checkbox"
            checked={showWidthUI}
            onChange={(e) => setShowWidthUI(e.target.checked)}
          />
          Show Width UI
        </label>
        <label className="dev-app__config-item">
          <input
            type="checkbox"
            checked={showHeightUI}
            onChange={(e) => setShowHeightUI(e.target.checked)}
          />
          Show Height UI
        </label>
        <label className="dev-app__config-item">
          <span>DPI:</span>
          <select
            value={dpi ?? ''}
            onChange={(e) => setDpi(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">None</option>
            <option value="203">203 DPI</option>
            <option value="300">300 DPI</option>
            <option value="600">600 DPI</option>
          </select>
        </label>
        <label className="dev-app__config-item">
          <span>Scale:</span>
          <select
            value={previewScale}
            onChange={(e) => setPreviewScale(Number(e.target.value))}
          >
            <option value="0.25">25%</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </label>
        <label className="dev-app__config-item">
          <span>Max Height:</span>
          <input
            type="number"
            min={CANVAS_HEIGHT_MIN}
            max={2400}
            step={20}
            value={maxHeight}
            onChange={(e) => setMaxHeight(Number(e.target.value) || CANVAS_HEIGHT_MAX)}
          />
        </label>
        {!showWidthUI && (
          <label className="dev-app__config-item">
            <span>Prop Width:</span>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            >
              {CANVAS_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w} px
                </option>
              ))}
            </select>
          </label>
        )}
        {!showHeightUI && (
          <label className="dev-app__config-item">
            <span>Prop Height:</span>
            <input
              type="number"
              min={CANVAS_HEIGHT_MIN}
              max={maxHeight}
              step={10}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      <CanvasEditor
        width={width}
        onWidthChange={setWidth}
        widths={CANVAS_WIDTHS}
        minHeight={CANVAS_HEIGHT_MIN}
        maxHeight={maxHeight}
        showWidthUI={showWidthUI}
        showHeightUI={showHeightUI}
        dpi={dpi}
        previewScale={previewScale}
        height={height}
        onHeightChange={setHeight}
        objects={objects}
        onChange={setObjects}
        onCopy={setClipboard}
        clipboard={clipboard}
      />
      <section className="dev-app__preview">
        <h2>Label Preview</h2>
        <div
          className="dev-app__preview-frame"
          style={{
            '--preview-height': `${Math.round(height * previewScale)}px`,
            '--preview-width': `${Math.round(width * previewScale)}px`,
          }}
        >
          {previewUrl ? (
            <img
              className="dev-app__preview-image"
              src={previewUrl}
              width={Math.round(width * previewScale)}
              height={Math.round(height * previewScale)}
              alt="Server-rendered 1-bit label"
            />
          ) : previewError ? (
            <div className="dev-app__preview-error">{previewError}</div>
          ) : null}
        </div>
      </section>
      <details className="dev-app__json">
        <summary>Object data</summary>
        <pre>{JSON.stringify({ width, height, objects }, null, 2)}</pre>
      </details>
    </div>
  )
}
