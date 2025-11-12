import { Menu, X } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import RecentRequests from './recentRequests'
import NewRequest from './newRequest'

type BoxProps = {
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
}

export default function Box({ box, setBox }: BoxProps) {
    const [sidebar, setSidebar] = useState(true)
    if (!box) {
        return
    }

    return (
        <div className='absolute top-18 right-2 z-40 w-200 h-196 grid grid-cols-5 gap-2'>
            {!sidebar && <div className='col-span-2 w-full' />}
            {sidebar && <div className=' bg-bright/3 backdrop-blur-md outline outline-dark p-2 h-full w-full rounded-lg gap-2 max-h-full overflow-hidden col-span-2'>
                <div className='w-full flex justify-between items-center'>
                    <h1 className='font-semibold text-lg'>Recent</h1>
                    <div className='outline outline-dark rounded-lg hover:bg-dark/50 h-10 w-10 grid place-items-center cursor-pointer'>
                        <X className='cursor-pointer' onClick={() => setSidebar(false)} />
                    </div>
                </div>
                <RecentRequests />
            </div>}
            <div className=' bg-bright/3 backdrop-blur-md outline outline-dark p-2 h-full w-full rounded-lg col-span-3'>
                <div className='w-full flex justify-between items-center'>
                    <h1 className='font-semibold text-lg'>New Request</h1>
                    <div className='flex gap-2'>
                        {!sidebar && <div className='outline outline-dark rounded-lg hover:bg-dark/50 h-10 w-10 grid place-items-center cursor-pointer'>
                            <Menu className='cursor-pointer' onClick={() => setSidebar(true)} />
                        </div>}
                        <div className='outline outline-dark rounded-lg hover:bg-dark/50 h-10 w-10 grid place-items-center cursor-pointer'>
                            <X className='cursor-pointer' onClick={() => setBox(false)} />
                        </div>
                    </div>
                </div>
                <NewRequest />
            </div>
        </div>
    )
}
