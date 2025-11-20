'use client'

import { getCookie } from '@/utils/cookies/cookies'
import { lockShare } from '@/utils/share/lockShare'
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'

type LockProps = {
    share: Share | null
    setError: Dispatch<SetStateAction<string | boolean | null>>
    baseButtonStyle: string
}

export default function Lock({ share, setError, baseButtonStyle }: LockProps) {
    const [locked, setLocked] = useState(share?.locked)

    async function handleLock() {
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (!id || !token) {
            return setError(`Login required.`)
        }

        const response = await lockShare(share!, id, token)
        if (response) {
            setLocked(response.locked)
        } else {
            setError(`Failed to ${locked ? 'unlock' : 'lock'} share.`)
        }
    }

    if (!share) {
        return (
            <div className={baseButtonStyle}>
                <LockKeyholeOpen height={22} width={22} />
            </div>
        )
    }

    return (
        <div onClick={handleLock} className={baseButtonStyle}>
            {locked ? <LockKeyhole height={22} width={22} /> : <LockKeyholeOpen height={22} width={22} />}
        </div>
    )
}
