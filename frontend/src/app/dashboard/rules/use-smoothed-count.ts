'use client'

import { useEffect, useRef, useState } from 'react'

export function useSmoothedCount(target: number | null | undefined, durationMs: number, previousSample?: number | null) {
    const [displayed, setDisplayed] = useState<number | null>(target ?? null)
    const displayedRef = useRef(displayed)
    const targetRef = useRef(target)

    useEffect(() => {
        if (target == null) {
            targetRef.current = target
            displayedRef.current = null
            setDisplayed(null)
            return
        }
        if (targetRef.current === target) return
        targetRef.current = target
        const from = typeof previousSample === 'number' && Number.isFinite(previousSample) ? previousSample : displayedRef.current
        if (from == null || from === target) {
            displayedRef.current = target
            setDisplayed(target)
            return
        }
        displayedRef.current = from
        setDisplayed(from)
        const start = performance.now()
        let frame = 0
        const animate = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs)
            const next = Math.round(from + (target - from) * progress)
            displayedRef.current = next
            setDisplayed(next)
            if (progress < 1) frame = requestAnimationFrame(animate)
        }
        frame = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frame)
    }, [target, durationMs, previousSample])

    return displayed
}
