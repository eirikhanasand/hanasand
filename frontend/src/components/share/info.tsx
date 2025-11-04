import { BookText, Eye, Link, ListOrdered, Pencil, Timer } from 'lucide-react'
import Marquee from '../marquee/marquee'
import { useEffect, useState } from 'react'
import copy from '@/utils/copy'
import prettyDate from '@/utils/prettyDate'

type HeaderProps = {
    share: Share | null
    isConnected: boolean
    participants: number
}

export default function Info({ share, isConnected, participants }: HeaderProps) {
    const [didCopy, setDidCopy] = useState<'error' | boolean>(false)
    const [copyText, setCopyText] = useState(share?.id || '')

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 1000)
    }, [didCopy])

    useEffect(() => {
        setCopyText(window.location.href.split('/').reverse()[0])
    }, [])

    if (!share) {
        return <></>
    }

    const wordText = `${share.wordCount} ${share.wordCount === 1 ? 'word' : 'words'}`
    const readText = `${share.estimatedMinutes} ${share.estimatedMinutes === 1 ? 'minute' : 'minutes'}`
    const lineCount = share.content.split(/\r?\n/).length
    const lineText = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`

    return (
        <div className='p-2 flex justify-between items-center rounded-lg'>
            <h1 className='font-semibold text-lg'>{share.path}</h1>
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
                    <Link className={didCopy === true ? 'stroke-green-600' : didCopy === false ? '' : 'stroke-red-500'} height={18} width={18} />
                    <div className='flex flex-col flex-1 overflow-hidden'>
                        <Marquee className='truncate' text={copyText} />
                    </div>
                </span>
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
