import { getCookie } from '@/utils/cookies'
import { lockShare } from '@/utils/share/lockShare'
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

export default function Lock({ share, setError }: { share: Share | null, setError: Dispatch<SetStateAction<string | null>> }) {
    const [locked, setLocked] = useState(share?.locked)

    async function handleLock() {
        const name = getCookie('name')
        if (!name) {
            return setError(`Login required.`)
        }

        const response = await lockShare(share!, name)
        if (response) {
            setLocked(response.locked)
        } else {
            setError(`Failed to ${locked ? 'unlock' : 'lock'} share.`)
        }
    }

    useEffect(() => {
        setLocked(share?.locked || false)
    }, [share])

    if (!share) {
        return (
            <div className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <LockKeyholeOpen height={22} width={22} />
            </div>
        )
    }

    return (
        <div onClick={handleLock} className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
            {locked ? <LockKeyhole height={22} width={22} /> : <LockKeyholeOpen height={22} width={22} />}
        </div>
    )
}