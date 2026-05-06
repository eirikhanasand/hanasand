import { Dispatch, SetStateAction, useEffect } from 'react'

export default function useHideIfLittleSpace({
    set,
    minWidth = 768,
}: {
    set: Dispatch<SetStateAction<boolean>>
    minWidth?: number
}) {
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < minWidth) {
                set(false)
            }
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [minWidth, set])
}
