import { Dispatch, SetStateAction } from 'react'
import Button from './button'

type ResultProps = {
    id: number
    result: SearchResult
    selectedResult: number
    setAction: Dispatch<SetStateAction<string | null>>
}

export default function Result({ id, result, selectedResult, setAction }: ResultProps) {
    const selected = selectedResult === id

    function handleClick() {
        setAction(result.action)
    }

    return (
        <div onClick={handleClick} className={`${selected ? 'bg-blue-400/10' : 'bg-bright/3'} w-full p-2 py-3 rounded-lg flex items-center justify-between cursor-pointer min-h-12 h-12 max-h-12`}>
            <h1>{result.text}</h1>
            {selected && <Button text='enter' />}
        </div>
    )
}
