import { Dispatch, SetStateAction } from 'react'

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
        <button
            type='button'
            aria-label={`Run action ${result.text}`}
            onClick={handleClick}
            className={`${selected ? 'bg-blue-400/10' : 'bg-bright/3'} flex h-12 min-h-12 max-h-12 w-full items-center justify-between rounded-lg p-2 py-3 text-left cursor-pointer`}
        >
            <h1>{result.text}</h1>
            {selected ? (
                <span className='w-fit rounded-lg p-[0.15rem] px-4 text-bright/70 outline outline-bright/10 backdrop-blur-xs'>
                    <h1>enter</h1>
                </span>
            ) : null}
        </button>
    )
}
