import { getBarcodeSize } from '../../utils/barcode'
import { PNG_SCALE_MIN } from './constants'

const PNG_PLACEHOLDER = 48

export function getTextboxBounds(obj) {
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
}

export const RESIZE_HANDLE_SIZE = 18

export function getBarcodeBounds(obj) {
  const { width, height } = getBarcodeSize(obj)
  return { x: obj.x, y: obj.y, w: width, h: height }
}

export function getPngBounds(obj, imageCache) {
  if (!obj.src) {
    const size = PNG_PLACEHOLDER * obj.scale
    return { x: obj.x, y: obj.y, w: size, h: size }
  }
  const img = imageCache.get(obj.src)
  if (img?.complete && img.naturalWidth) {
    return {
      x: obj.x,
      y: obj.y,
      w: img.naturalWidth * obj.scale,
      h: img.naturalHeight * obj.scale,
    }
  }
  const size = PNG_PLACEHOLDER * obj.scale
  return { x: obj.x, y: obj.y, w: size, h: size }
}

export function getObjectBounds(obj, imageCache) {
  switch (obj.type) {
    case 'textbox':
      return getTextboxBounds(obj)
    case 'barcode':
      return getBarcodeBounds(obj)
    case 'png':
      return getPngBounds(obj, imageCache)
    default:
      return null
  }
}

export function getResizeHandleBounds(obj, imageCache, size = RESIZE_HANDLE_SIZE) {
  const bounds = getObjectBounds(obj, imageCache)
  if (!bounds) return null
  const cx = bounds.x + bounds.w
  const cy = bounds.y + bounds.h
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size }
}

export function pointInBounds(px, py, bounds) {
  return (
    px >= bounds.x &&
    px <= bounds.x + bounds.w &&
    py >= bounds.y &&
    py <= bounds.y + bounds.h
  )
}

export function hitResizeHandle(px, py, obj, imageCache, size = RESIZE_HANDLE_SIZE) {
  const handle = getResizeHandleBounds(obj, imageCache, size)
  return Boolean(handle && pointInBounds(px, py, handle))
}

export function hitTest(objects, px, py, imageCache) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    const bounds = getObjectBounds(obj, imageCache)
    if (bounds && pointInBounds(px, py, bounds)) {
      return obj.id
    }
  }
  return null
}

/** Selected object handle wins over overlapping objects. */
export function findResizeHandleHit(objects, px, py, imageCache, preferredId = null) {
  if (preferredId) {
    const preferred = objects.find((o) => o.id === preferredId)
    if (preferred && hitResizeHandle(px, py, preferred, imageCache)) {
      return preferred.id
    }
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (hitResizeHandle(px, py, obj, imageCache)) {
      return obj.id
    }
  }

  return null
}

export function resizePatchForObject(obj, drag, dx, dy) {
  switch (obj.type) {
    case 'textbox':
      return {
        w: Math.max(20, Math.round(drag.origW + dx)),
        h: Math.max(20, Math.round(drag.origH + dy)),
      }
    case 'barcode': {
      const newW = Math.max(40, drag.origBoundsW + dx)
      const newH = Math.max(20, drag.origBoundsH + dy)
      return {
        scale: Math.max(1, Math.round(drag.origScale * (newW / drag.origBoundsW))),
        h: Math.max(10, Math.round(drag.origH * (newH / drag.origBoundsH))),
      }
    }
    case 'png': {
      const newW = Math.max(1, drag.origBoundsW + dx)
      const newH = Math.max(1, drag.origBoundsH + dy)
      const factor = Math.max(newW / drag.origBoundsW, newH / drag.origBoundsH)
      return {
        scale: Math.max(PNG_SCALE_MIN, Math.round(drag.origScale * factor * 1000) / 1000),
      }
    }
    default:
      return {}
  }
}

export function createResizeDrag(obj, imageCache, startX, startY) {
  const bounds = getObjectBounds(obj, imageCache)
  const drag = {
    mode: 'resize',
    id: obj.id,
    objectType: obj.type,
    startX,
    startY,
    origBoundsW: bounds.w,
    origBoundsH: bounds.h,
  }

  if (obj.type === 'textbox') {
    drag.origW = obj.w
    drag.origH = obj.h
  } else if (obj.type === 'barcode') {
    drag.origScale = obj.scale
    drag.origH = obj.h
  } else if (obj.type === 'png') {
    drag.origScale = obj.scale
  }

  return drag
}
