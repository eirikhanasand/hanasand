'use client'

import { useEffect, useRef, useState } from 'react'

export function useSmoothedCount(target: number | null | undefined, durationMs: number, rate?: number | null, sampledAt?: number) {
    const [displayed, setDisplayed] = useState<number | null>(target ?? null)
    const displayedRef = useRef(displayed)

    useEffect(() => {
        if (target != null && rate != null && Number.isFinite(rate) && rate > 0 && sampledAt != null && Number.isFinite(sampledAt)) {
            const update = () => {
                const elapsedSeconds = Math.max(0, Date.now() - sampledAt) / 1000
                const next = Math.round(target + rate * elapsedSeconds)
                displayedRef.current = next
                setDisplayed(next)
            }
            update()
            const updateIntervalMs = Math.max(1, Math.round(1000 / rate))
            const interval = window.setInterval(update, updateIntervalMs)
            return () => window.clearInterval(interval)
        }
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
    }, [target, durationMs, rate, sampledAt])

    return displayed
}
