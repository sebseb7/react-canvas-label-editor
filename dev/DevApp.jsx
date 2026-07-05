import { useEffect, useRef, useState } from 'react'
import {
  CanvasEditor,
  CANVAS_HEIGHT_DEFAULT,
  CANVAS_WIDTH,
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
  const [height, setHeight] = useState(CANVAS_HEIGHT_DEFAULT)
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
          body: JSON.stringify({ height, objects }),
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
  }, [height, objects])

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
      <CanvasEditor
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
          style={{ '--preview-height': `${height}px` }}
        >
          {previewUrl ? (
            <img
              className="dev-app__preview-image"
              src={previewUrl}
              width={CANVAS_WIDTH}
              height={height}
              alt="Server-rendered 1-bit label"
            />
          ) : previewError ? (
            <div className="dev-app__preview-error">{previewError}</div>
          ) : null}
        </div>
      </section>
      <details className="dev-app__json">
        <summary>Object data</summary>
        <pre>{JSON.stringify({ height, objects }, null, 2)}</pre>
      </details>
    </div>
  )
}
