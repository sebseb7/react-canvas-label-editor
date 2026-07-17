import { getBarcodeSize } from '../../utils/barcode'
import {
  canvasPointToTextboxLocal,
  normalizeRotation,
  rotationFromPointer,
  snapRotation,
  textboxCenter,
  withTextboxRotation,
} from '../../utils/textboxRotation'
import { PNG_SCALE_MIN } from './constants'

const PNG_PLACEHOLDER = 48

export function getTextboxBounds(obj) {
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
}

export const RESIZE_HANDLE_SIZE = 18
export const ROTATE_HANDLE_SIZE = 14
export const ROTATE_HANDLE_OFFSET = 28

export {
  canvasPointToTextboxLocal,
  normalizeRotation,
  rotationFromPointer,
  snapRotation,
  textboxCenter,
  withTextboxRotation,
}

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

/** Axis-aligned bounds of a textbox after rotation (for clamping). */
export function getTextboxAxisAlignedBounds(obj) {
  const rotation = snapRotation(obj.rotation ?? 0)
  if (rotation === 90 || rotation === 270) {
    const { cx, cy } = textboxCenter(obj)
    return { x: cx - obj.h / 2, y: cy - obj.w / 2, w: obj.h, h: obj.w }
  }
  return getTextboxBounds(obj)
}

/** Keep an object's top-left inside the canvas so its bounds stay visible. */
export function clampObjectToCanvas(obj, canvasWidth, canvasHeight, imageCache) {
  if (obj.type === 'textbox') {
    const aabb = getTextboxAxisAlignedBounds(obj)
    const maxAabbX = Math.max(0, canvasWidth - aabb.w)
    const maxAabbY = Math.max(0, canvasHeight - aabb.h)
    const clampedAabbX = Math.min(Math.max(0, aabb.x), maxAabbX)
    const clampedAabbY = Math.min(Math.max(0, aabb.y), maxAabbY)
    const nextX = Math.round(obj.x + (clampedAabbX - aabb.x))
    const nextY = Math.round(obj.y + (clampedAabbY - aabb.y))
    if (nextX === obj.x && nextY === obj.y) return obj
    return { ...obj, x: nextX, y: nextY }
  }

  const bounds = getObjectBounds(obj, imageCache)
  if (!bounds) return obj

  const maxX = Math.max(0, Math.round(canvasWidth - bounds.w))
  const maxY = Math.max(0, Math.round(canvasHeight - bounds.h))
  const x = Math.min(Math.max(0, Math.round(obj.x)), maxX)
  const y = Math.min(Math.max(0, Math.round(obj.y)), maxY)

  if (x === obj.x && y === obj.y) return obj
  return { ...obj, x, y }
}

export function getResizeHandleBounds(obj, imageCache, size = RESIZE_HANDLE_SIZE) {
  const bounds = getObjectBounds(obj, imageCache)
  if (!bounds) return null
  const cx = bounds.x + bounds.w
  const cy = bounds.y + bounds.h
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size }
}

export function getRotateHandleBounds(obj, size = ROTATE_HANDLE_SIZE) {
  if (obj.type !== 'textbox') return null
  const cx = obj.x + obj.w / 2
  const cy = obj.y - ROTATE_HANDLE_OFFSET
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

function localPointForHandle(obj, px, py) {
  if (obj.type === 'textbox') return canvasPointToTextboxLocal(obj, px, py)
  return { x: px, y: py }
}

export function hitResizeHandle(px, py, obj, imageCache, size = RESIZE_HANDLE_SIZE) {
  const local = localPointForHandle(obj, px, py)
  const handle = getResizeHandleBounds(obj, imageCache, size)
  return Boolean(handle && pointInBounds(local.x, local.y, handle))
}

export function hitRotateHandle(px, py, obj, size = ROTATE_HANDLE_SIZE) {
  if (obj.type !== 'textbox') return false
  const local = canvasPointToTextboxLocal(obj, px, py)
  const handle = getRotateHandleBounds(obj, size)
  return Boolean(handle && pointInBounds(local.x, local.y, handle))
}

export function hitTest(objects, px, py, imageCache) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (obj.type === 'textbox') {
      const local = canvasPointToTextboxLocal(obj, px, py)
      const bounds = getTextboxBounds(obj)
      if (bounds && pointInBounds(local.x, local.y, bounds)) return obj.id
      continue
    }
    const bounds = getObjectBounds(obj, imageCache)
    if (bounds && pointInBounds(px, py, bounds)) {
      return obj.id
    }
  }
  return null
}

/**
 * Prefer the selected object's handles. Returns `{ id, mode }` where mode is
 * `'resize'` or `'rotate'`.
 */
export function findHandleHit(objects, px, py, imageCache, preferredId = null) {
  const check = (obj) => {
    if (hitRotateHandle(px, py, obj)) return { id: obj.id, mode: 'rotate' }
    if (hitResizeHandle(px, py, obj, imageCache)) return { id: obj.id, mode: 'resize' }
    return null
  }

  if (preferredId) {
    const preferred = objects.find((o) => o.id === preferredId)
    if (preferred) {
      const hit = check(preferred)
      if (hit) return hit
    }
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    const hit = check(objects[i])
    if (hit) return hit
  }

  return null
}

/** @deprecated Prefer findHandleHit */
export function findResizeHandleHit(objects, px, py, imageCache, preferredId = null) {
  const hit = findHandleHit(objects, px, py, imageCache, preferredId)
  return hit?.mode === 'resize' ? hit.id : null
}

export function resizePatchForObject(obj, drag, dx, dy) {
  switch (obj.type) {
    case 'textbox': {
      const rotation = normalizeRotation(obj.rotation ?? 0)
      const rad = (-rotation * Math.PI) / 180
      const localDx = dx * Math.cos(rad) - dy * Math.sin(rad)
      const localDy = dx * Math.sin(rad) + dy * Math.cos(rad)
      return {
        w: Math.max(20, Math.round(drag.origW + localDx)),
        h: Math.max(20, Math.round(drag.origH + localDy)),
      }
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

export function createRotateDrag(obj) {
  const { cx, cy } = textboxCenter(obj)
  return {
    mode: 'rotate',
    id: obj.id,
    cx,
    cy,
    origRotation: snapRotation(obj.rotation ?? 0),
  }
}
