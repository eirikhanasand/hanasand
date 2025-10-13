import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'

type MovableProps = {
    side: 'left' | 'right'
    setHide: Dispatch<SetStateAction<boolean>>
}

export default function useMovable({ setHide, side }: MovableProps) {
    const elementWidth = 80
    const distanceFromTop = 75
    const distanceFromSide = 20
    const initialPosition = side === 'left' ? { x: distanceFromSide, y: distanceFromTop } : { x: 0, y: distanceFromTop }
    const [position, setPosition] = useState(initialPosition)
    const [dragging, setDragging] = useState(false)
    const [hasMoved, setHasMoved] = useState(false)
    const dragStart = useRef({ x: 0, y: 0 })

    function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        setDragging(true)
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        }
    }

    function handleMouseMove(e: MouseEvent) {
        if (!dragging) return

        const newX = e.clientX - dragStart.current.x
        const newY = e.clientY - dragStart.current.y


        if (Math.abs(newX - position.x) > 3 || Math.abs(newY - position.y) > 3) {
            setHasMoved(true)
        }

        setPosition({ x: newX, y: newY })
    }

    function handleMouseUp() {
        setDragging(false)
        setTimeout(() => {
            setHasMoved(false)
        }, 50)
    }

    function handleOpen() {
        if (!hasMoved) {
            setHide(true)
        }
    }

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    })

    useEffect(() => {
        if (window && side === 'right') {
            const right = window.innerWidth - elementWidth - distanceFromSide
            position.x = right
            setPosition(prev => ({ x: right, y: prev.y }))
        }
    }, [side])

    return { position, handleMouseDown, handleOpen }
}
