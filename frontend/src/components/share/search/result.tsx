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
            className={`${selected ? 'border-[#f07d33]/32 bg-[#f07d33]/8 text-bright/88' : 'border-transparent bg-bright/[0.025] text-bright/58 hover:border-bright/10 hover:bg-bright/[0.045] hover:text-bright/76'} flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition`}
        >
            <span className='min-w-0 truncate text-sm font-normal'>{result.text}</span>
            {selected ? (
                <span className='inline-flex h-6 shrink-0 items-center rounded-md border border-bright/10 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-bright/46'>
                    <h1>enter</h1>
                </span>
            ) : null}
        </button>
    )
}
