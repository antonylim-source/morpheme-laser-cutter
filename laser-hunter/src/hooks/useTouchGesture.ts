import { useEffect, useMemo, useRef, useState } from 'react'
import type { TouchGesture } from '../types/game.types'

type Options = {
  onGestureComplete?: (endX: number, endY: number) => void
}

export function useTouchGesture<T extends HTMLElement = HTMLDivElement>(opts: Options = {}) {
  const ref = useRef<T | null>(null)
  const [gesture, setGesture] = useState<TouchGesture>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    currentX: 0,
    currentY: 0,
    isActive: false,
  })

  const stateRef = useRef(gesture)
  stateRef.current = gesture

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const toLocal = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect()
      return { x: clientX - r.left, y: clientY - r.top }
    }

    const begin = (clientX: number, clientY: number) => {
      const p = toLocal(clientX, clientY)
      setGesture({
        startX: p.x,
        startY: p.y,
        endX: p.x,
        endY: p.y,
        currentX: p.x,
        currentY: p.y,
        isActive: true,
      })
    }

    const move = (clientX: number, clientY: number) => {
      const s = stateRef.current
      if (!s.isActive) return
      const p = toLocal(clientX, clientY)
      setGesture({ ...s, currentX: p.x, currentY: p.y })
    }

    const end = (clientX: number, clientY: number) => {
      const s = stateRef.current
      if (!s.isActive) return
      const p = toLocal(clientX, clientY)
      const next: TouchGesture = { ...s, endX: p.x, endY: p.y, currentX: p.x, currentY: p.y, isActive: false }
      setGesture(next)

      // vertical slash validation
      const dy = Math.abs(next.endY - next.startY)
      if (dy > 30) opts.onGestureComplete?.(next.endX, next.endY)
    }

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 1) return
      const t = e.touches[0]!
      begin(t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 1) return
      const t = e.touches[0]!
      move(t.clientX, t.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      end(t.clientX, t.clientY)
    }

    // Mouse (desktop)
    let mouseDown = false
    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true
      begin(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return
      move(e.clientX, e.clientY)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDown) return
      mouseDown = false
      end(e.clientX, e.clientY)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [opts])

  return useMemo(() => ({ ref, gesture }), [gesture])
}

