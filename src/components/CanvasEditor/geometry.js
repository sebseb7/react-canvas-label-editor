import { getBarcodeSize } from '../../utils/barcode'
import {
  boundsCenter,
  canvasPointToBoundsLocal,
  canvasPointToTextboxLocal,
  normalizeRotation,
  rotationFromPointer,
  snapRotation,
  textboxCenter,
  withBoundsRotation,
  withTextboxRotation,
} from '../../utils/textboxRotation'
import { PNG_SCALE_MIN } from './constants'

const PNG_PLACEHOLDER = 48
export const CROP_MIN_SIZE = 8

export function getTextboxBounds(obj) {
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
}

export const RESIZE_HANDLE_SIZE = 18
export const ROTATE_HANDLE_SIZE = 14
export const ROTATE_HANDLE_OFFSET = 28
export const CROP_HANDLE_SIZE = 14

export {
  boundsCenter,
  canvasPointToBoundsLocal,
  canvasPointToTextboxLocal,
  normalizeRotation,
  rotationFromPointer,
  snapRotation,
  textboxCenter,
  withBoundsRotation,
  withTextboxRotation,
}

export function objectSupportsRotation(obj) {
  return obj?.type === 'textbox' || obj?.type === 'png'
}

export function getBarcodeBounds(obj) {
  const { width, height } = getBarcodeSize(obj)
  return { x: obj.x, y: obj.y, w: width, h: height }
}

export function getPngBounds(obj, imageCache, cropInsets = null) {
  if (!obj.src) {
    const size = PNG_PLACEHOLDER * obj.scale
    return { x: obj.x, y: obj.y, w: size, h: size }
  }
  const img = imageCache.get(obj.src)
  if (img?.complete && img.naturalWidth) {
    const fullW = img.naturalWidth * obj.scale
    const fullH = img.naturalHeight * obj.scale
    if (!cropInsets) {
      return { x: obj.x, y: obj.y, w: fullW, h: fullH }
    }
    const left = cropInsets.left ?? 0
    const top = cropInsets.top ?? 0
    const right = cropInsets.right ?? 0
    const bottom = cropInsets.bottom ?? 0
    return {
      x: obj.x + left,
      y: obj.y + top,
      w: Math.max(CROP_MIN_SIZE, fullW - left - right),
      h: Math.max(CROP_MIN_SIZE, fullH - top - bottom),
    }
  }
  const size = PNG_PLACEHOLDER * obj.scale
  return { x: obj.x, y: obj.y, w: size, h: size }
}

export function getObjectBounds(obj, imageCache, cropInsets = null) {
  switch (obj.type) {
    case 'textbox':
      return getTextboxBounds(obj)
    case 'barcode':
      return getBarcodeBounds(obj)
    case 'png':
      return getPngBounds(obj, imageCache, cropInsets)
    default:
      return null
  }
}

/** Axis-aligned bounds after rotation (for clamping / hit chrome). */
export function getAxisAlignedBounds(obj, imageCache, cropInsets = null) {
  const bounds = getObjectBounds(obj, imageCache, cropInsets)
  if (!bounds) return null
  if (!objectSupportsRotation(obj)) return bounds
  const rotation = snapRotation(obj.rotation ?? 0)
  if (rotation === 90 || rotation === 270) {
    const { cx, cy } = boundsCenter(bounds)
    return { x: cx - bounds.h / 2, y: cy - bounds.w / 2, w: bounds.h, h: bounds.w }
  }
  return bounds
}

/** @deprecated Prefer getAxisAlignedBounds */
export function getTextboxAxisAlignedBounds(obj) {
  return getAxisAlignedBounds(obj, null)
}

/** Keep an object's top-left inside the canvas so its bounds stay visible. */
export function clampObjectToCanvas(obj, canvasWidth, canvasHeight, imageCache) {
  if (objectSupportsRotation(obj)) {
    const aabb = getAxisAlignedBounds(obj, imageCache)
    if (!aabb) return obj
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

export function getRotateHandleBounds(obj, imageCache, size = ROTATE_HANDLE_SIZE) {
  if (!objectSupportsRotation(obj)) return null
  const bounds = getObjectBounds(obj, imageCache)
  if (!bounds) return null
  const cx = bounds.x + bounds.w / 2
  const cy = bounds.y - ROTATE_HANDLE_OFFSET
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size }
}

/** Mid-edge crop handles for the full (uncropped) image bounds. */
export function getCropHandleBounds(obj, imageCache, cropInsets, size = CROP_HANDLE_SIZE) {
  const full = getPngBounds(obj, imageCache, null)
  if (!full) return null
  const cropped = getPngBounds(obj, imageCache, cropInsets)
  if (!cropped) return null
  const half = size / 2
  return {
    left: {
      side: 'left',
      x: cropped.x - half,
      y: cropped.y + cropped.h / 2 - half,
      w: size,
      h: size,
    },
    right: {
      side: 'right',
      x: cropped.x + cropped.w - half,
      y: cropped.y + cropped.h / 2 - half,
      w: size,
      h: size,
    },
    top: {
      side: 'top',
      x: cropped.x + cropped.w / 2 - half,
      y: cropped.y - half,
      w: size,
      h: size,
    },
    bottom: {
      side: 'bottom',
      x: cropped.x + cropped.w / 2 - half,
      y: cropped.y + cropped.h - half,
      w: size,
      h: size,
    },
    full,
    cropped,
  }
}

export function pointInBounds(px, py, bounds) {
  return (
    px >= bounds.x &&
    px <= bounds.x + bounds.w &&
    py >= bounds.y &&
    py <= bounds.y + bounds.h
  )
}

function localPointForObject(obj, px, py, imageCache) {
  if (!objectSupportsRotation(obj)) return { x: px, y: py }
  const bounds = getObjectBounds(obj, imageCache)
  if (!bounds) return { x: px, y: py }
  return canvasPointToBoundsLocal(bounds, obj.rotation, px, py)
}

export function hitResizeHandle(px, py, obj, imageCache, size = RESIZE_HANDLE_SIZE) {
  const local = localPointForObject(obj, px, py, imageCache)
  const handle = getResizeHandleBounds(obj, imageCache, size)
  return Boolean(handle && pointInBounds(local.x, local.y, handle))
}

export function hitRotateHandle(px, py, obj, imageCache, size = ROTATE_HANDLE_SIZE) {
  if (!objectSupportsRotation(obj)) return false
  const local = localPointForObject(obj, px, py, imageCache)
  const handle = getRotateHandleBounds(obj, imageCache, size)
  return Boolean(handle && pointInBounds(local.x, local.y, handle))
}

export function hitCropHandle(px, py, obj, imageCache, cropInsets, size = CROP_HANDLE_SIZE) {
  if (obj.type !== 'png') return null
  const local = localPointForObject(obj, px, py, imageCache)
  const handles = getCropHandleBounds(obj, imageCache, cropInsets, size)
  if (!handles) return null
  for (const side of ['left', 'right', 'top', 'bottom']) {
    if (pointInBounds(local.x, local.y, handles[side])) return side
  }
  return null
}

export function hitTest(objects, px, py, imageCache) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (objectSupportsRotation(obj)) {
      const bounds = getObjectBounds(obj, imageCache)
      if (!bounds) continue
      const local = canvasPointToBoundsLocal(bounds, obj.rotation, px, py)
      if (pointInBounds(local.x, local.y, bounds)) return obj.id
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
 * Prefer the selected object's handles. Returns `{ id, mode, side? }` where mode is
 * `'resize'`, `'rotate'`, or `'crop'`.
 */
export function findHandleHit(
  objects,
  px,
  py,
  imageCache,
  preferredId = null,
  { cropModeId = null, cropInsets = null } = {},
) {
  const check = (obj) => {
    if (cropModeId && obj.id === cropModeId && obj.type === 'png') {
      const side = hitCropHandle(px, py, obj, imageCache, cropInsets)
      if (side) return { id: obj.id, mode: 'crop', side }
      return null
    }
    if (hitRotateHandle(px, py, obj, imageCache)) return { id: obj.id, mode: 'rotate' }
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
      if (obj.format === 'QR') {
        const newW = Math.max(1, drag.origBoundsW + dx)
        const newH = Math.max(1, drag.origBoundsH + dy)
        const factor = Math.max(newW / drag.origBoundsW, newH / drag.origBoundsH)
        return {
          scale: Math.max(1, Math.round(drag.origScale * factor)),
        }
      }
      const newW = Math.max(40, drag.origBoundsW + dx)
      const newH = Math.max(20, drag.origBoundsH + dy)
      return {
        scale: Math.max(1, Math.round(drag.origScale * (newW / drag.origBoundsW))),
        h: Math.max(10, Math.round(drag.origH * (newH / drag.origBoundsH))),
      }
    }
    case 'png': {
      const rotation = normalizeRotation(obj.rotation ?? 0)
      const rad = (-rotation * Math.PI) / 180
      const localDx = dx * Math.cos(rad) - dy * Math.sin(rad)
      const localDy = dx * Math.sin(rad) + dy * Math.cos(rad)
      const newW = Math.max(1, drag.origBoundsW + localDx)
      const newH = Math.max(1, drag.origBoundsH + localDy)
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

export function createRotateDrag(obj, imageCache) {
  const bounds = getObjectBounds(obj, imageCache)
  const { cx, cy } = boundsCenter(bounds)
  return {
    mode: 'rotate',
    id: obj.id,
    cx,
    cy,
    origRotation: snapRotation(obj.rotation ?? 0),
  }
}

export function createCropDrag(obj, imageCache, side, startX, startY, cropInsets) {
  const full = getPngBounds(obj, imageCache, null)
  return {
    mode: 'crop',
    id: obj.id,
    side,
    startX,
    startY,
    origInsets: { ...(cropInsets ?? { left: 0, top: 0, right: 0, bottom: 0 }) },
    fullW: full.w,
    fullH: full.h,
  }
}

/** Clamp crop insets so the remaining region stays at least CROP_MIN_SIZE. */
export function clampCropInsets(insets, fullW, fullH) {
  const left = Math.max(0, insets.left ?? 0)
  const top = Math.max(0, insets.top ?? 0)
  const right = Math.max(0, insets.right ?? 0)
  const bottom = Math.max(0, insets.bottom ?? 0)
  const maxLeft = Math.max(0, fullW - right - CROP_MIN_SIZE)
  const maxTop = Math.max(0, fullH - bottom - CROP_MIN_SIZE)
  const maxRight = Math.max(0, fullW - left - CROP_MIN_SIZE)
  const maxBottom = Math.max(0, fullH - top - CROP_MIN_SIZE)
  return {
    left: Math.min(left, maxLeft),
    top: Math.min(top, maxTop),
    right: Math.min(right, maxRight),
    bottom: Math.min(bottom, maxBottom),
  }
}

export function cropInsetsFromDrag(drag, dx, dy, rotation = 0) {
  const rad = (-normalizeRotation(rotation) * Math.PI) / 180
  const localDx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const localDy = dx * Math.sin(rad) + dy * Math.cos(rad)
  const next = { ...drag.origInsets }
  switch (drag.side) {
    case 'left':
      next.left = drag.origInsets.left + localDx
      break
    case 'right':
      next.right = drag.origInsets.right - localDx
      break
    case 'top':
      next.top = drag.origInsets.top + localDy
      break
    case 'bottom':
      next.bottom = drag.origInsets.bottom - localDy
      break
    default:
      break
  }
  return clampCropInsets(next, drag.fullW, drag.fullH)
}

/**
 * Bake display-space crop insets into a new image data URL and position patch.
 * Returns null if there is nothing to crop.
 */
export function bakePngCrop(obj, sourceImage, cropInsets) {
  const left = Math.max(0, cropInsets?.left ?? 0)
  const top = Math.max(0, cropInsets?.top ?? 0)
  const right = Math.max(0, cropInsets?.right ?? 0)
  const bottom = Math.max(0, cropInsets?.bottom ?? 0)
  if (left === 0 && top === 0 && right === 0 && bottom === 0) return null

  const scale = obj.scale || 1
  const sx = Math.round(left / scale)
  const sy = Math.round(top / scale)
  const sw = Math.max(1, Math.round(sourceImage.naturalWidth - left / scale - right / scale))
  const sh = Math.max(1, Math.round(sourceImage.naturalHeight - top / scale - bottom / scale))
  if (sw >= sourceImage.naturalWidth && sh >= sourceImage.naturalHeight && sx === 0 && sy === 0) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, sw, sh)
  const src = canvas.toDataURL('image/png')

  return {
    src,
    x: Math.round(obj.x + left),
    y: Math.round(obj.y + top),
  }
}
