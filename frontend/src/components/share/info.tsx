import { BookText, Eye, Link, ListOrdered, MessageCircleHeart, Pencil, Timer } from 'lucide-react'
import Marquee from '../marquee/marquee'
import { useEffect, useState } from 'react'
import copy from '@/utils/copy'
import prettyDate from '@/utils/prettyDate'
import useClearStateAfter from '@/hooks/useClearStateAfter'

type HeaderProps = {
    share: Share | null
    isConnected: boolean
    participants: number
}

export default function Info({ share, isConnected, participants }: HeaderProps) {
    const [didCopy, setDidCopy] = useState<string | boolean>(false)
    const [linkText, setLinkText] = useState(share?.id || '')
    const aliasText = share?.alias || ''
    const [error, setError] = useState(null)

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 1000)
    }, [didCopy])

    useEffect(() => {
        setLinkText(window.location.href.split('/').reverse()[0])
    }, [])

    useClearStateAfter({ condition: error, set: setError, timeout: 5000 })

    if (!share) {
        return <></>
    }

    const wordText = `${share.wordCount} ${share.wordCount === 1 ? 'word' : 'words'}`
    const readText = `${share.estimatedMinutes} ${share.estimatedMinutes === 1 ? 'minute' : 'minutes'}`
    const lineCount = share.content.split(/\r?\n/).length
    const lineText = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`

    return (
        <div className='p-2 flex justify-between items-center rounded-lg'>
            <div className='grid w-full gap-4'>
                <div className='flex gap-2'>
                    <Eye className='text-gray-400' height={18} width={18} />
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                        {participants}
                    </span>
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                    </span>
                </div>
                <span className='gap-2 text-sm text-gray-400 flex'>
                    <Pencil height={18} width={18} />
                    <h1>{prettyDate(share.timestamp)}</h1>
                </span>
                <span onClick={() => copy({ text: window.location.href, setDidCopy })} className='flex gap-2 text-sm text-gray-400 w-full overflow-hidden cursor-pointer'>
                    <Link className={didCopy === 'link' ? 'stroke-green-600' : didCopy === null ? '' : didCopy === 'error-link' ? 'stroke-red-500' : ''} height={18} width={18} />
                    <div className='flex flex-col flex-1 overflow-hidden'>
                        <Marquee className='truncate' text={linkText} />
                    </div>
                </span>
                {aliasText !== linkText && <span onClick={() => copy({ text: window.location.href, setDidCopy })} className='flex gap-2 text-sm text-gray-400 w-full overflow-hidden cursor-pointer'>
                    <MessageCircleHeart className={didCopy === 'alias' ? 'stroke-green-600' : didCopy === null ? '' : didCopy === 'error-alias' ? 'stroke-red-500' : ''} height={18} width={18} />
                    <div className='flex flex-col flex-1 overflow-hidden'>
                        <Marquee className='truncate' text={aliasText} />
                    </div>
                </span>}
                <span className='gap-2 text-sm text-gray-400 flex'>
                    <BookText height={18} width={18} />
                    <h1>{wordText}</h1>
                </span>
                <span className='gap-2 text-sm text-gray-400 flex'>
                    <ListOrdered height={18} width={18} />
                    <h1>{lineText}</h1>
                </span>
                <span className='gap-2 text-sm text-gray-400 flex'>
                    <Timer height={18} width={18} />
                    <h1>{readText}</h1>
                </span>
            </div>
        </div>
    )
}
