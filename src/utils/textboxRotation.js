/** Normalize degrees into [0, 360). */
export function normalizeRotation(degrees) {
  const n = Number(degrees)
  if (!Number.isFinite(n)) return 0
  return ((Math.round(n) % 360) + 360) % 360
}

/** Snap to the nearest 90° step (0 / 90 / 180 / 270). */
export function snapRotation(degrees) {
  return normalizeRotation(Math.round(normalizeRotation(degrees) / 90) * 90)
}

export function boundsCenter(bounds) {
  return { cx: bounds.x + bounds.w / 2, cy: bounds.y + bounds.h / 2 }
}

export function textboxCenter(obj) {
  return boundsCenter({ x: obj.x, y: obj.y, w: obj.w, h: obj.h })
}

export function withBoundsRotation(ctx, bounds, rotationDegrees, draw) {
  const rotation = normalizeRotation(rotationDegrees ?? 0)
  if (!rotation) {
    draw()
    return
  }
  const { cx, cy } = boundsCenter(bounds)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  draw()
  ctx.restore()
}

export function withTextboxRotation(ctx, obj, draw) {
  withBoundsRotation(ctx, { x: obj.x, y: obj.y, w: obj.w, h: obj.h }, obj.rotation, draw)
}

/** Map a canvas point into an object's unrotated local space. */
export function canvasPointToBoundsLocal(bounds, rotationDegrees, px, py) {
  const rotation = normalizeRotation(rotationDegrees ?? 0)
  if (!rotation) return { x: px, y: py }
  const { cx, cy } = boundsCenter(bounds)
  const rad = (-rotation * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

/** Map a canvas point into the textbox's unrotated local space. */
export function canvasPointToTextboxLocal(obj, px, py) {
  return canvasPointToBoundsLocal(
    { x: obj.x, y: obj.y, w: obj.w, h: obj.h },
    obj.rotation,
    px,
    py,
  )
}

export function rotationFromPointer(cx, cy, px, py) {
  const deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI
  // Rotate handle sits above the box at 0°, which is atan2 = -90°.
  return snapRotation(deg + 90)
}
