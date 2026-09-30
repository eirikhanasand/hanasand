'use client'

import { useState } from 'react'
import VmConsole from '@/components/vms/consoleClient'

export default function HostConsoleClient() {
    const [host, setHost] = useState<'hanasand' | 'inspur'>('hanasand')
    return <VmConsole key={host} host={host} onHostChange={setHost} />
}
