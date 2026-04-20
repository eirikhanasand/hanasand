import { useCallback, useState } from 'react'
import type { PageClientProps, VulnerabilityPageState } from './types'
import { toPageState } from './helpers'

export default function usePageState({ initialData, refreshAction }: Pick<PageClientProps, 'initialData' | 'refreshAction'>) {
    const [{ data, error }, setPageState] = useState<VulnerabilityPageState>(() => toPageState(initialData))
    const [isRefreshing, setIsRefreshing] = useState(false)

    const refresh = useCallback(async () => {
        setIsRefreshing(true)
        const next = await refreshAction()
        const nextState = toPageState(next)
        setPageState(prev => ({ data: nextState.data ?? prev.data, error: nextState.error }))
        setIsRefreshing(false)
    }, [refreshAction])

    return { data, error, isRefreshing, refresh, setPageState }
}
