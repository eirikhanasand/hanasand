'use client'

import { useEffect, useRef, useState } from 'react'

export function useSmoothedCount(target: number | null | undefined, durationMs: number, previousSample?: number | null) {
    const initial = typeof previousSample === 'number' && Number.isFinite(previousSample) ? previousSample : target ?? null
    const [displayed, setDisplayed] = useState<number | null>(initial)
    const displayedRef = useRef(displayed)
    const previousSampleRef = useRef(previousSample)

    useEffect(() => {
        previousSampleRef.current = previousSample
    }, [previousSample])

    useEffect(() => {
        if (target == null) {
            displayedRef.current = null
            setDisplayed(null)
            return
        }
        const sample = previousSampleRef.current
        const from = typeof sample === 'number' && Number.isFinite(sample) ? sample : displayedRef.current
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
    }, [target, durationMs])

    return displayed
}
