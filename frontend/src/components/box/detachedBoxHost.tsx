'use client'

import { useEffect, useState } from 'react'
import Box from './box'
import { DETACHED_BOX_EVENT, loadDetachedBoxState } from './detachedStorage'
import type { DetachedBoxState } from './types'

export default function DetachedBoxHost() {
    const [state, setState] = useState<DetachedBoxState>({ open: false, share: null })

    useEffect(() => {
        setState(loadDetachedBoxState())

        function handleStorage(event: StorageEvent) {
            if (event.key) {
                setState(loadDetachedBoxState())
            }
        }

        function handleDetach(event: Event) {
            const detail = (event as CustomEvent<DetachedBoxState>).detail
            setState(detail || loadDetachedBoxState())
        }

        window.addEventListener('storage', handleStorage)
        window.addEventListener(DETACHED_BOX_EVENT, handleDetach)
        return () => {
            window.removeEventListener('storage', handleStorage)
            window.removeEventListener(DETACHED_BOX_EVENT, handleDetach)
        }
    }, [])

    if (!state.open) {
        return null
    }

    return (
        <Box
            box={state.open}
            setBox={(next) => {
                const resolved = typeof next === 'function' ? next(state.open) : next
                setState((current) => ({ ...current, open: resolved }))
            }}
            share={state.share as Share | null}
            detached
        />
    )
}
