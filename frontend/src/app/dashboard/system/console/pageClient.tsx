'use client'

import { useState } from 'react'
import VmConsole from '@/components/vms/consoleClient'

export default function HostConsoleClient({ initialHost }: { initialHost: 'inspur' | 'ovh' }) {
    const [host, setHost] = useState<'inspur' | 'ovh'>(initialHost)
    return <VmConsole key={host} host={host} onHostChange={setHost} />
}
