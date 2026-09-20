'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Position = { right: number; bottom: number }
type Dock = { x: number; y: number }
type Sample = { x: number; y: number; time: number }
const gap = 16
const storageKey = 'hanasand-support-dock'
const directions: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
const clamp = (value: number, max: number) => Math.max(gap, Math.min(value, max))

export default function useSupportPosition(visible: boolean) {
    const ref = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<Position>({ right: gap, bottom: gap })
    const [moving, setMoving] = useState(false)
    const [isDefault, setIsDefault] = useState(true)
    const current = useRef(position)
    const dock = useRef<Dock>({ x: 0, y: 0 })
    const dragged = useRef(false)
    const drag = useRef<{ id: number; x: number; y: number; origin: Position; samples: Sample[] } | null>(null)

    const bounds = useCallback(() => {
        const box = ref.current?.getBoundingClientRect()
        return { right: Math.max(gap, window.innerWidth - (box?.width || 64) - gap), bottom: Math.max(gap, window.innerHeight - (box?.height || 64) - gap) }
    }, [])
    const place = useCallback((next: Position) => {
        const max = bounds()
        current.current = { right: clamp(next.right, max.right), bottom: clamp(next.bottom, max.bottom) }
        setPosition(current.current)
    }, [bounds])
    const applyDock = useCallback((next: Dock, persist = true) => {
        const max = bounds()
        dock.current = next
        const target = { right: gap + next.x * (max.right - gap), bottom: gap + next.y * (max.bottom - gap) }
        setIsDefault(target.right === gap && target.bottom === gap)
        place(target)
        if (persist) try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Docking still works without storage. */ }
    }, [bounds, place])
    const settle = useCallback((projected: Position) => {
        const max = bounds()
        let right = clamp(projected.right, max.right), bottom = clamp(projected.bottom, max.bottom)
        const horizontalDistance = Math.min(right - gap, max.right - right)
        const verticalDistance = Math.min(bottom - gap, max.bottom - bottom)
        const nearestX = right - gap <= max.right - right ? gap : max.right
        const nearestY = bottom - gap <= max.bottom - bottom ? gap : max.bottom
        // Prefer a corner near the landing point; otherwise attach to the nearest wall.
        if (horizontalDistance <= verticalDistance) {
            right = nearestX
            if (verticalDistance <= Math.min(160, (max.bottom - gap) / 4)) bottom = nearestY
        } else {
            bottom = nearestY
            if (horizontalDistance <= Math.min(160, (max.right - gap) / 4)) right = nearestX
        }
        applyDock({ x: (right - gap) / (max.right - gap || 1), y: (bottom - gap) / (max.bottom - gap || 1) })
    }, [applyDock, bounds])

    useEffect(() => {
        if (!visible) return
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.x >= 0 && saved.x <= 1 && saved.y >= 0 && saved.y <= 1 && (saved.x === 0 || saved.x === 1 || saved.y === 0 || saved.y === 1)) applyDock(saved)
            else {
                const previous = JSON.parse(localStorage.getItem('hanasand-support-position') || 'null')
                if (previous && Number.isFinite(previous.right) && Number.isFinite(previous.bottom)) settle(previous)
            }
        } catch { /* Ignore invalid settings or unavailable storage. */ }
        const resize = () => { if (!drag.current) applyDock(dock.current, false) }
        const observer = new ResizeObserver(resize)
        if (ref.current) observer.observe(ref.current)
        window.addEventListener('resize', resize)
        return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
    }, [applyDock, settle, visible])

    function cancelDrag() {
        if (!drag.current) return
        drag.current = null
        setMoving(false)
        if (dragged.current) settle(current.current)
        else applyDock(dock.current)
    }

    return {
        ref,
        style: position,
        moving,
        isDefault,
        reset: () => applyDock({ x: 0, y: 0 }),
        wasDragged: () => { const value = dragged.current; dragged.current = false; return value },
        handlers: {
            onPointerDown(event: PointerEvent<HTMLElement>) {
                if (event.button !== 0 || !event.isPrimary) return
                const box = ref.current!.getBoundingClientRect()
                const origin = { right: window.innerWidth - box.right, bottom: window.innerHeight - box.bottom }
                setMoving(true)
                place(origin)
                dragged.current = false
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin, samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }] }
                event.currentTarget.setPointerCapture(event.pointerId)
            },
            onPointerMove(event: PointerEvent<HTMLElement>) {
                const start = drag.current
                if (!start || event.pointerId !== start.id) return
                start.samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp })
                while (start.samples.length > 2 && start.samples[0].time < event.timeStamp - 100) start.samples.shift()
                const x = event.clientX - start.x, y = event.clientY - start.y
                if (!dragged.current && Math.hypot(x, y) < 5) return
                dragged.current = true
                place({ right: start.origin.right - x, bottom: start.origin.bottom - y })
            },
            onPointerUp(event: PointerEvent<HTMLElement>) {
                const start = drag.current
                if (!start || start.id !== event.pointerId) return
                drag.current = null
                setMoving(false)
                if (dragged.current) {
                    const first = start.samples[0], last = start.samples.at(-1)!
                    const elapsed = Math.max(16, last.time - first.time)
                    const velocity = (delta: number) => event.timeStamp - last.time > 100 ? 0 : Math.max(-3, Math.min(3, delta / elapsed))
                    settle({ right: current.current.right - velocity(last.x - first.x) * 220, bottom: current.current.bottom - velocity(last.y - first.y) * 220 })
                } else applyDock(dock.current)
                event.currentTarget.releasePointerCapture(event.pointerId)
            },
            onPointerCancel: cancelDrag,
            onLostPointerCapture: cancelDrag,
            onKeyDown(event: KeyboardEvent<HTMLElement>) {
                const direction = directions[event.key]
                if (!direction) { dragged.current = false; return }
                event.preventDefault()
                // Arrow keys choose the corresponding edge; a second axis chooses a corner.
                applyDock({ x: direction[0] ? (direction[0] > 0 ? 1 : 0) : dock.current.x, y: direction[1] ? (direction[1] > 0 ? 1 : 0) : dock.current.y })
            },
        },
    }
}
