import { Eye, Link, Pencil } from 'lucide-react'
import Marquee from '../marquee/marquee'
import { useEffect, useState } from 'react'

type HeaderProps = {
    share: Share | null
    isConnected: boolean
    participants: number
}

export default function Header({ share, isConnected, participants }: HeaderProps) {
    const [copy, setCopy] = useState<'error' | boolean>(false)
    function handleCopyLink() {
        navigator.clipboard.writeText(window.location.href)
            .then(() => {
                setCopy(true)
            })
            .catch((err) => {
                setCopy('error')
            })
    }

    useEffect(() => {
        setTimeout(() => {
            setCopy(false)
        }, 1000)
    }, [copy])

    if (!share) {
        return <></>
    }

    return (
        <header className='bg-[#2d2d2d] p-4 flex justify-between items-center shadow-md rounded-lg'>
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
                    <h1>{new Date(share.timestamp).toLocaleString()}</h1>
                </span>
                <span onClick={handleCopyLink} className='flex gap-2 text-sm text-gray-400 w-full overflow-hidden cursor-pointer'>
                    <Link className={copy === true ? 'stroke-green-600' : copy === false ? '' : 'stroke-red-500'} height={18} width={18} />
                    <div className='flex flex-col flex-1 overflow-hidden'>
                        <Marquee className='truncate' text={window.location.href.split('/').reverse()[0]} />
                    </div>
                </span>
            </div>
        </header>
    )
}
