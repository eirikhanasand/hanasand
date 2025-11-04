import { Dispatch, SetStateAction, useEffect } from 'react'

type ClearStateAfterProps = { 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    condition: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set: Dispatch<SetStateAction<any>>
    timeout?: number
    onClear?: () => void
}

// Generic function to clear any variable after x seconds. 
export default function useClearStateAfter({ condition, set, timeout = 5000, onClear }: ClearStateAfterProps) {
    useEffect(() => {
        if (!condition) {
            return
        }

        const timeout = setTimeout(() => {
            set(null)
            if (onClear) onClear()
        }, 5000)

        return () => clearTimeout(timeout)
    }, [condition, set, timeout, onClear])
}
