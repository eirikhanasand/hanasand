import useKeyPress from '@/hooks/keyPressed'
import { SearchCode, X } from 'lucide-react'
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
    const previousFocusRef = useRef<HTMLElement | null>(null)
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
            setVisible(prev => {
                if (!prev) {
                    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                }
                return !prev
            })
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
        } else if (!visible) {
            previousFocusRef.current?.focus()
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
        return null
    }

    return (
        <div onClick={() => setVisible(false)} className='absolute inset-0 z-80 grid place-items-start justify-center bg-ui-canvas/30 px-3 pt-[12vh] backdrop-blur-md'>
            <div
                role='dialog'
                aria-modal='true'
                aria-label='Command palette'
                onClick={(e) => e.stopPropagation()}
                className='z-10 grid max-h-[72vh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10'
            >
                <div className='flex min-h-12 items-center justify-between gap-2 rounded-lg border border-ui-border bg-ui-raised px-3'>
                    <div className='flex min-w-0 flex-1 items-center gap-2'>
                        <SearchCode className='h-4 w-4 shrink-0 stroke-ui-primary' />
                        <input
                            ref={inputRef}
                            aria-label='Command search'
                            placeholder='Search commands'
                            className='h-10 min-w-0 flex-1 bg-transparent text-sm font-normal text-ui-text caret-ui-primary outline-none placeholder:text-ui-muted'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button className='hidden sm:inline-flex' onClick={() => setVisible(false)} text='esc' />
                    <button
                        type='button'
                        aria-label='Close command search'
                        onClick={() => setVisible(false)}
                        className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-panel hover:text-ui-text sm:hidden'
                    >
                        <X className='h-4 w-4' />
                    </button>
                </div>
                <div className='mt-2 grid min-h-0 content-start gap-1 overflow-y-auto'>
                    {results?.length ? (
                        results.map((result, id) => <Result
                            key={id}
                            id={id}
                            result={result}
                            selectedResult={selectedResult}
                            setAction={setAction}
                        />)
                    ) : (
                        <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-4 text-sm font-normal text-ui-muted'>
                            Start typing to filter workspace actions.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
