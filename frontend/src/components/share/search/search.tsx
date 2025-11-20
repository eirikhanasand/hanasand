import useKeyPress from '@/hooks/keyPressed'
import { SearchCode } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import interpretQuery from './interpretQuery'
import Result from './result'
import Button from './button'
import performAction from './performAction'
import { getCookie, setCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'

type SearchProps = {
    setTriggerSiteChange: Dispatch<SetStateAction<boolean | 'close'>>
    setBox: Dispatch<SetStateAction<boolean>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    setShowMetaData: Dispatch<SetStateAction<boolean>>
}

export default function Search({
    setTriggerSiteChange,
    setBox,
    setTriggerTerminalChange,
    setShowExplorer,
    setShowMetaData
}: SearchProps) {
    const [search, setSearch] = useState('')
    const [visible, setVisible] = useState(false)
    const [results, setResults] = useState<SearchResult[] | null>(null)
    const [selectedResult, setSelectedResult] = useState(0)
    const [action, setAction] = useState<string | null>(null)
    const keys = useKeyPress(['meta', 'control', 'k', 'arrowup', 'arrowdown', 'enter'])
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    function act(action: string) {
        performAction({
            action,
            setVisible,
            setSearch,
            setTriggerSiteChange,
            setBox,
            setTriggerTerminalChange,
            toggleTheme,
            setShowExplorer,
            setShowMetaData,
            setSelectedResult,
            router
        })
    }

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
                act(results.find((_, id) => id === selectedResult)?.action || '')
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
            act(action)
            setAction(null)
        }
    }, [action])

    const [theme, setTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        const savedTheme = getCookie('theme') as 'dark' | 'light'
        if (savedTheme) {
            setTheme(savedTheme)
        }

        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(theme)
    }, [theme])

    function toggleTheme() {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setCookie('theme', newTheme)
        setTheme(newTheme)
    }

    if (!visible) {
        return
    }

    return (
        <div onClick={() => setVisible(false)} className='absolute top-0 left-0 w-full h-full z-80 grid place-items-center backdrop-blur-xs'>
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
