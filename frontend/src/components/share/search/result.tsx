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
            className={`${selected ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-transparent bg-ui-raised text-ui-muted hover:border-ui-border hover:bg-ui-panel hover:text-ui-text'} flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition`}
        >
            <span className='min-w-0 truncate text-sm font-normal'>{result.text}</span>
            {selected ? (
                <span className='inline-flex h-6 shrink-0 items-center rounded-md border border-ui-border px-2 text-[10px] font-medium uppercase tracking-normal text-ui-muted'>
                    <h1>enter</h1>
                </span>
            ) : null}
        </button>
    )
}
