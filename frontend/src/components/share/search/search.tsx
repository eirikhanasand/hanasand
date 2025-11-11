import useKeyPress from '@/hooks/keyPressed'
import { SearchCode } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import interpretQuery from './interpretQuery'
import Result from './result'
import Button from './button'
import performAction from './performAction'

type SearchProps = {
    setTriggerSiteChange: Dispatch<SetStateAction<boolean>>
}

export default function Search({ setTriggerSiteChange }: SearchProps) {
    const [search, setSearch] = useState('')
    const [visible, setVisible] = useState(false)
    const [results, setResults] = useState<SearchResult[] | null>(null)
    const [selectedResult, setSelectedResult] = useState(0)
    const [action, setAction] = useState<string | null>(null)
    const keys = useKeyPress(['meta', 'control', 'k', 'arrowup', 'arrowdown', 'enter'])
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (keys['k'] && (keys['meta'] || keys['control'])) {
            setVisible(prev => !prev)
        }
    }, [keys])

    useEffect(() => {
        if (results?.length) {
            if (search && keys['arrowup']) {
                if (selectedResult > 0) {
                    setSelectedResult(prev => prev - 1)
                }
            }

            if (search && keys['arrowdown']) {
                if (selectedResult < results.length - 1) {
                    setSelectedResult(prev => prev + 1)
                }
            }

            if (search && keys['enter']) {
                performAction({
                    action: results.find((_, id) => id === selectedResult)?.action || '',
                    setVisible,
                    setSearch,
                    setTriggerSiteChange
                })
            }
        }

        if (!results && !search && keys['enter']) {
            setVisible(false)
        }
    }, [keys, results, search])

    useEffect(() => {
        if (!visible) return

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key.toLowerCase() === 'escape') {
                e.preventDefault()
                setVisible(false)
            }

            if (e.key.toLowerCase() === 'arrowup' || e.key.toLowerCase() === 'arrowdown') {
                e.preventDefault()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [visible])

    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus()
        }
    }, [visible])

    useEffect(() => {
        if (search.trim()) {
            const allResults = interpretQuery(search)
            setResults(allResults)
        } else {
            setResults(null)
        }
    }, [search])

    useEffect(() => {
        if (typeof action === 'string') {
            performAction({
                action,
                setVisible,
                setSearch,
                setTriggerSiteChange
            })
            setAction(null)
        }
    }, [action])

    if (!visible) {
        return
    }

    return (
        <div onClick={() => setVisible(false)} className='absolute top-0 left-0 w-full h-full z-50 grid place-items-center backdrop-blur-xs'>
            <div onClick={(e) => e.stopPropagation()} className=' rounded-lg p-2 md:h-120 overflow-hidden z-10 w-[80vw] md:w-200 bg-bright/3 outline outline-bright/10 space-y-2'>
                {/* input */}
                <div className='flex gap-2 p-1 px-2 w-full items-center bg-bright/2 rounded-lg justify-between'>
                    <div className='flex items-center w-full'>
                        <SearchCode className='stroke-[#e25822]' />
                        <input
                            ref={inputRef}
                            className='w-full rounded-lg p-2 outline-none text-bright/60 caret-[#e25822] text-lg'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button className='cursor-pointer' onClick={() => setVisible(false)} text='esc' />
                </div>
                {/* results */}
                <div className='w-full grid gap-2'>
                    {results?.map((result, id) => <Result 
                        key={id} 
                        id={id} 
                        result={result} 
                        selectedResult={selectedResult}
                        setAction={setAction}
                    />)}
                </div>
            </div>
        </div>
    )
}
