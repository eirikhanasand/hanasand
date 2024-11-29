import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { Dispatch, MutableRefObject, SetStateAction } from "react"

type HandleNavigationProps = {
    direction: string
    current: number | undefined
    router: AppRouterInstance
    setAnimateAnswer: Dispatch<SetStateAction<string>>
    setSelected: Dispatch<SetStateAction<number[]>>
    checkAnswer: (input: number[], attempted: number[], setAttempted: Dispatch<SetStateAction<number[]>>, next?: true) => void
    id: string | undefined
    card: Card
    cards: Card[]
    selectedRef: MutableRefObject<number[]>
    attempted: number[]
    setAttempted: Dispatch<SetStateAction<number[]>>
    wait: boolean
    setWait: Dispatch<SetStateAction<boolean>>
    indexMapping: number[]
}

type HandleKeyDownProps = {
    event: KeyboardEvent
    navigate: (direction: string) => void
}

type animate200msProps = {
    key: string
    setAnimateAnswer: Dispatch<SetStateAction<string>>
}

// Handles navigation for the cards component
export default function handleCardsNavigation({
    direction, 
    current, 
    router, 
    setAnimateAnswer, 
    setSelected, 
    checkAnswer,
    id,
    card, 
    cards, 
    selectedRef,
    attempted,
    setAttempted,
    wait,
    setWait,
    indexMapping
}: HandleNavigationProps) {
        if (!card || current === undefined) {
            return
        }
    
        function handleKey(key: string) {        
            // Animates the answer
            animate200ms({ key, setAnimateAnswer })
        
            // Gets the original index using indexMapping
            const originalIndex = indexMapping[Number(key)]
        
            // Checks the answer using the original index
            checkAnswer([originalIndex], attempted, setAttempted)
        
            // Updates the selected state with the original index
            setSelected((prev) => card.correct.length > 1 ? [...prev, originalIndex] : [originalIndex])
        }

        switch (direction) {
        case 'back': 
            if (current != undefined) {
                const previous = current === 0 ? 1 : current
                router.push(`/course/${id}/${previous}`)
            }

            animate200ms({key: 'back', setAnimateAnswer})
            setSelected([])
            break
        case 'skip': 
            if (current != undefined) {
                const skip = (current + 1) % cards.length + 1
                router.push(`/course/${id}/${skip}`)
            }

            animate200ms({key: 'skip', setAnimateAnswer})
            setSelected([])
            break
        case 'next':

            checkAnswer(selectedRef.current, attempted, setAttempted, true)
            animate200ms({key: 'next', setAnimateAnswer})

            if (wait) {
                setAttempted([...attempted, ...selectedRef.current]) 
                setWait(false)
            }


            break
        case '1': handleKey('0'); break
        case '2': handleKey('1'); break
        case '3': handleKey('2'); break
        case '4': handleKey('3'); break
        case '5': handleKey('4'); break
        case '6': handleKey('5'); break
        case '7': handleKey('6'); break
        case '8': handleKey('7'); break
        case '9': handleKey('8'); break
        case '0': handleKey('9'); break
        case 'w':
        case 'W':
        case 'up': 
            setSelected((prev) => {
                const newSelected = [...prev]
                const newIndex = (prev[0] === card.alternatives.length - 1) ? 0 : prev[0] + 1

                if (card.correct.length <= 1) {
                    return [newIndex]
                }

                newSelected.unshift(newIndex)
                return newSelected
            })
            break
        case 'down': 
            setSelected((prev) => {
                const newSelected = [...prev]
                const newIndex = (prev[0] === 0) ? card.alternatives.length - 1 : prev[0] - 1
                
                if (card.correct.length <= 1) {
                    return [newIndex]
                }
                
                newSelected.unshift(newIndex)
                return newSelected
            })
            break
        case 'shiftup':
            setSelected((prev) => {
                const newSelected = [...prev];
                const newIndex = (prev[0] === card.alternatives.length - 1) ? 0 : prev[0] + 1
                const previousIndex = (newIndex === 0) ? card.alternatives.length - 1 : newIndex - 1
            
                for (let i = newSelected.length - 1; i >= 0; i--) {
                    if (newSelected[i] === previousIndex) {
                        newSelected.splice(i, 1)
                    }
                }
            
                newSelected.unshift(newIndex)
                return newSelected
            })
            break
            case 'shiftdown':
                setSelected((prev) => {
                    const newSelected = [...prev]
                    const newIndex = (prev[0] === 0) ? card.alternatives.length - 1 : prev[0] - 1     
                    const previousIndex = (newIndex === card.alternatives.length - 1) ? 0 : newIndex + 1
                    
                    for (let i = newSelected.length - 1; i >= 0; i--) {
                        if (newSelected[i] === previousIndex) {
                            newSelected.splice(i, 1)
                        }
                    }

                    newSelected.unshift(newIndex)
                    return newSelected
                })
            break
    }
}
    
export function handleKeyDown({event, navigate}: HandleKeyDownProps) {
    const activeElement = document.activeElement
    if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return
    }

    switch (event.key) {
        case 'd':
        case 'D':
        case 'n':
        case 'N':
        case 'Enter':
        case 'ArrowRight': navigate('next'); break
        case 'a':
        case 'A':
        case 'b':
        case 'B':
        case 'p':
        case 'P':
        case 'ArrowLeft': navigate('back'); break
        case 's': 
        case 'S': navigate('skip'); break
        case '1': navigate("1"); break
        case '2': navigate("2"); break
        case '3': navigate("3"); break
        case '4': navigate("4"); break
        case '5': navigate("5"); break
        case '6': navigate("6"); break
        case '7': navigate("7"); break
        case '8': navigate("8"); break
        case '9': navigate("9"); break
        case '0': navigate("0"); break
        case 'w':
        case 'ArrowUp': 
            if (event.shiftKey) {
                navigate('shiftup')
            } else {
                navigate('up')
            }
            break
        case 'W':
        case 'ArrowDown': 
            if (event.shiftKey) {
                navigate('shiftdown')
            } else {
                navigate('down')
            }
            break
    }
}

export function animate200ms({key, setAnimateAnswer}: animate200msProps) {
    setAnimateAnswer(key)
    setTimeout(() => setAnimateAnswer("-1"), 200)
}
