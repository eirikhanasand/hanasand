import { Dispatch, SetStateAction, useEffect, useState } from 'react'

type ClearStateAfterInputProps = {
    initialState?: string | boolean | null
    timeout?: number
    onClear?: () => void
}

type ClearStateAfterProps = {
    condition: string | boolean | null
    setCondition: Dispatch<SetStateAction<string | boolean | null>>
}

// Generic function to clear any variable after x seconds. 
export default function useClearStateAfter({
    initialState = null,
    timeout = 5000,
    onClear
}: ClearStateAfterInputProps = {}): ClearStateAfterProps {
    const [condition, setCondition] = useState<string | null | boolean>(initialState)
    useEffect(() => {
        if (!condition) {
            return
        }

        const timeout = setTimeout(() => {
            setCondition(null)
            if (onClear) {
                onClear()
            }
        }, 5000)

        return () => clearTimeout(timeout)
    }, [condition, setCondition, timeout, onClear])

    return { condition, setCondition }
}
