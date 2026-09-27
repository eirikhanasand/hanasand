'use client'

import { useEffect, useRef, useState } from 'react'

export function useSmoothedCount(target: number | null | undefined, durationMs: number) {
    const [displayed, setDisplayed] = useState<number | null>(target ?? null)
    const displayedRef = useRef(displayed)

    useEffect(() => {
        if (target == null) {
            displayedRef.current = null
            setDisplayed(null)
            return
        }
        const from = displayedRef.current
        if (from == null || from === target) {
            displayedRef.current = target
            setDisplayed(target)
            return
        }
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
    }, [target, durationMs])

    return displayed
}
