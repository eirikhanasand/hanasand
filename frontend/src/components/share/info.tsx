import { BookText, Eye, Link, ListOrdered, MessageCircleHeart, Pencil, Timer } from 'lucide-react'
import Marquee from '../marquee/marquee'
import copy from '@/utils/copy'
import prettyDate from '@/utils/date/prettyDate'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import Notify from '../notify/notify'
import { usePathname } from 'next/navigation'

type HeaderProps = {
    share: Share | null
    isConnected: boolean
    participants: number
}

export default function Info({ share, isConnected, participants }: HeaderProps) {
    const pathname = usePathname()
    const linkText = pathname.split('/').filter(Boolean).at(-1) || share?.id || ''
    const aliasText = share?.alias || ''
    const { condition: error } = useClearStateAfter()
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 1000,
        onClear: () => setDidCopy(false)
    })

    if (!share) {
        return <></>
    }

    const wordText = `${share.wordCount} ${share.wordCount === 1 ? 'word' : 'words'}`
    const readText = `${share.estimatedMinutes} ${share.estimatedMinutes === 1 ? 'minute' : 'minutes'}`
    const lineCount = share.content.split(/\r?\n/).length
    const lineText = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`
    const copyColorLink = didCopy === 'link' ? 'stroke-green-600' : didCopy === null ? '' : didCopy === 'error-link' ? 'stroke-red-500' : ''
    const copyColorAlias = didCopy === 'alias' ? 'stroke-green-600' : didCopy === null ? '' : didCopy === 'error-alias' ? 'stroke-red-500' : ''

    return (
        <div className='p-2 flex justify-between items-center rounded-lg'>
            <div className='grid w-full gap-4'>
                <div className='flex gap-2'>
                    <Eye className='text-bright/80' height={18} width={18} />
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-bright/80'}`}>
                        {participants}
                    </span>
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-bright/80'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                    </span>
                </div>
                <span className='gap-2 text-sm text-bright/80 flex'>
                    <Pencil height={18} width={18} />
                    <h1>{prettyDate(share.timestamp)}</h1>
                </span>
                <button
                    type='button'
                    aria-label='Copy current share link'
                    onClick={() => copy({ type: 'link', text: window.location.href, setDidCopy })}
                    className='flex w-full cursor-pointer gap-2 overflow-hidden text-left text-sm text-bright/80'
                >
                    <Link
                        className={copyColorLink}
                        height={18}
                        width={18}
                    />
                    <div className='flex flex-col flex-1 overflow-hidden'>
                        <Marquee className='truncate' text={linkText} />
                    </div>
                </button>
                {aliasText !== linkText && (
                    <button
                        type='button'
                        aria-label='Copy share alias link'
                        onClick={() => copy({ type: 'alias', text: `https://${share.alias}.hanasand.com`, setDidCopy })}
                        className='flex w-full cursor-pointer gap-2 overflow-hidden text-left text-sm text-bright/80'
                    >
                        <MessageCircleHeart
                            className={copyColorAlias}
                            height={18}
                            width={18}
                        />
                        <div className='flex flex-col flex-1 overflow-hidden'>
                            <Marquee className='truncate' text={aliasText} />
                        </div>
                    </button>
                )}
                <span className='gap-2 text-sm text-bright/80 flex'>
                    <BookText height={18} width={18} />
                    <h1>{wordText}</h1>
                </span>
                <span className='gap-2 text-sm text-bright/80 flex'>
                    <ListOrdered height={18} width={18} />
                    <h1>{lineText}</h1>
                </span>
                <span className='gap-2 text-sm text-bright/80 flex'>
                    <Timer height={18} width={18} />
                    <h1>{readText}</h1>
                </span>
                <Notify message={error} />
            </div>
        </div>
    )
}
