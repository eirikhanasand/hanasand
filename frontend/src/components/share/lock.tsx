'use client'

import { getCookie } from '@/utils/cookies'
import { lockShare } from '@/utils/share/lockShare'
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

type LockProps = {
    share: Share | null
    setError: Dispatch<SetStateAction<string | boolean | null>>
    baseButtonStyle: string
}

export default function Lock({ share, setError, baseButtonStyle }: LockProps) {
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
