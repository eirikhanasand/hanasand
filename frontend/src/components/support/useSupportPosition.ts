'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Position = { right: number; bottom: number }
const storageKey = 'hanasand-support-position'
const directions: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

export default function useSupportPosition(visible: boolean) {
    const ref = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<Position>({ right: 16, bottom: 16 })
    const current = useRef(position)
    const dragged = useRef(false)
    const drag = useRef<{ id: number; x: number; y: number; origin: Position } | null>(null)

    const place = useCallback((next: Position, persist = false) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        const bounded = {
            right: Math.max(8, Math.min(next.right, window.innerWidth - box.width - 8)),
            bottom: Math.max(8, Math.min(next.bottom, window.innerHeight - box.height - 8)),
        }
        current.current = bounded
        setPosition(bounded)
        if (persist) try { localStorage.setItem(storageKey, JSON.stringify(bounded)) } catch { /* Movement still works when storage is unavailable. */ }
    }, [])

    useEffect(() => {
        if (!visible) return
        let saved = current.current
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) || 'null')
            if (value && Number.isFinite(value.right) && Number.isFinite(value.bottom)) saved = value
        } catch { /* Ignore unavailable storage or an invalid saved position. */ }
        place(saved)
        const resize = () => place(current.current)
        const observer = new ResizeObserver(resize)
        if (ref.current) observer.observe(ref.current)
        window.addEventListener('resize', resize)
        return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
    }, [place, visible])

    return {
        ref,
        style: position,
        wasDragged: () => dragged.current,
        handlers: {
            onPointerDown(event: PointerEvent<HTMLElement>) {
                if (event.button !== 0 || !event.isPrimary) return
                dragged.current = false
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: current.current }
                event.currentTarget.setPointerCapture(event.pointerId)
            },
            onPointerMove(event: PointerEvent<HTMLElement>) {
                const start = drag.current
                if (!start || event.pointerId !== start.id) return
                const x = event.clientX - start.x, y = event.clientY - start.y
                if (!dragged.current && Math.hypot(x, y) < 5) return
                dragged.current = true
                place({ right: start.origin.right - x, bottom: start.origin.bottom - y })
            },
            onPointerUp(event: PointerEvent<HTMLElement>) {
                if (drag.current?.id !== event.pointerId) return
                drag.current = null
                if (dragged.current) place(current.current, true)
                event.currentTarget.releasePointerCapture(event.pointerId)
            },
            onPointerCancel() { drag.current = null },
            onLostPointerCapture() { drag.current = null },
            onKeyDown(event: KeyboardEvent<HTMLElement>) {
                const direction = directions[event.key]
                if (!direction) { dragged.current = false; return }
                event.preventDefault()
                const step = event.shiftKey ? 40 : 10
                place({ right: current.current.right + direction[0] * step, bottom: current.current.bottom + direction[1] * step }, true)
            },
        },
    }
}
