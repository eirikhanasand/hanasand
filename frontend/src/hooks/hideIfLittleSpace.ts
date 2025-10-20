import { Dispatch, SetStateAction, useEffect } from 'react'

export default function HideIfLittleSpace({set}: {set: Dispatch<SetStateAction<boolean>>}) {
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < 768) {
                set(false)
            }
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [set])
}
