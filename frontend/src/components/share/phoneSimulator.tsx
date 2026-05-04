'use client'

import useTerminal from '@/hooks/useTerminal'
import { sendViaShareVm } from '@/utils/box/requestTool'
import { LoaderCircle, Play, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

type PhoneSimulatorProps = {
    share: Share | null
    open: boolean
}

type SimulatorState = 'idle' | 'starting' | 'checking' | 'online' | 'offline'

const EXPO_STATUS_URLS = [
    'http://localhost:8081/status',
    'http://127.0.0.1:8081/status',
]

export default function PhoneSimulator({ share, open }: PhoneSimulatorProps) {
    const [state, setState] = useState<SimulatorState>('idle')
    const [message, setMessage] = useState('Run npm start in the connected project VM, then this phone will attach to Expo Metro.')
    const [lastBody, setLastBody] = useState('')
    const { isConnected, chunks, sendInput } = useTerminal({ share, active: open && Boolean(share) })
    const recentOutput = useMemo(() => chunks.slice(-8).join('').trim(), [chunks])

    const checkExpo = useCallback(async () => {
        if (!share?.alias) {
            setState('offline')
            setMessage('No project VM is connected yet.')
            return false
        }

        setState('checking')
        setMessage('Checking Expo Metro on the project VM...')

        for (const url of EXPO_STATUS_URLS) {
            const response = await sendViaShareVm({
                shareAlias: share.alias,
                method: 'GET',
                url,
                headers: {},
                body: '',
            })
            const body = typeof response.body === 'string'
                ? response.body
                : typeof response.raw === 'string'
                    ? response.raw
                    : ''
            setLastBody(body || response.error || '')

            if (!response.error && (response.ok || response.status === 200) && body.toLowerCase().includes('packager-status:running')) {
                setState('online')
                setMessage('Expo Metro is running from this project VM.')
                return true
            }
        }

        setState('offline')
        setMessage('Expo Metro is not reachable yet. Start it with npm start from the project root.')
        return false
    }, [share?.alias])

    const startExpo = useCallback(() => {
        setState('starting')
        setMessage('Sent npm start to the project VM. Waiting for Expo Metro...')
        sendInput('npm start -- --host 0.0.0.0\n')
        window.setTimeout(() => {
            void checkExpo()
        }, 2500)
    }, [checkExpo, sendInput])

    if (!open) {
        return null
    }

    const isBusy = state === 'starting' || state === 'checking'
    const isOnline = state === 'online'

    return (
        <section className='mt-3 rounded-[2rem] bg-black/35 p-4 text-bright outline outline-dark/80'>
            <div className='mx-auto w-full max-w-[18rem] rounded-[2.4rem] border border-bright/15 bg-[#080908] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)]'>
                <div className='relative overflow-hidden rounded-[2rem] border border-bright/10 bg-linear-to-br from-[#1a2119] via-[#11140f] to-black px-4 py-5'>
                    <div className='mb-5 flex items-center justify-between text-xs font-semibold text-bright/70'>
                        <span>00:34</span>
                        <div className='h-6 w-20 rounded-full bg-black/70' />
                        {isOnline ? <Wifi className='h-4 w-4 text-green-400' /> : <WifiOff className='h-4 w-4 text-bright/40' />}
                    </div>

                    <div className='mb-5'>
                        <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bright/8 outline outline-bright/10'>
                            <Smartphone className='h-6 w-6 text-bright/85' />
                        </div>
                        <h2 className='text-2xl font-semibold tracking-tight'>Expo phone</h2>
                        <p className='mt-2 text-sm leading-5 text-bright/55'>{message}</p>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isOnline ? 'border-green-400/25 bg-green-400/8' : 'border-bright/10 bg-black/25'}`}>
                        <div className='flex items-center gap-2 text-sm font-semibold'>
                            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : isBusy ? 'bg-orange-300' : 'bg-bright/35'}`} />
                            {isOnline ? 'Metro online' : isBusy ? 'Starting Metro' : 'Ready to start'}
                        </div>
                        <p className='mt-2 text-xs leading-5 text-bright/50'>
                            Runs `npm start` in the connected share VM and probes `localhost:8081/status`.
                        </p>
                    </div>

                    <div className='mt-4 grid grid-cols-2 gap-2'>
                        <button
                            type='button'
                            onClick={startExpo}
                            disabled={!share || isBusy}
                            className='inline-flex items-center justify-center gap-2 rounded-2xl bg-bright px-3 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            {state === 'starting' ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />}
                            npm start
                        </button>
                        <button
                            type='button'
                            onClick={() => void checkExpo()}
                            disabled={!share || isBusy}
                            className='inline-flex items-center justify-center gap-2 rounded-2xl bg-bright/8 px-3 py-2 text-sm font-semibold text-bright outline outline-bright/10 transition hover:bg-bright/12 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            {state === 'checking' ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            Check
                        </button>
                    </div>

                    <div className='mt-4 rounded-2xl bg-black/30 p-3 text-xs leading-5 text-bright/50 outline outline-bright/8'>
                        <p className='font-semibold text-bright/70'>VM terminal</p>
                        <p>{isConnected ? 'Connected to project shell.' : 'Connecting to project shell...'}</p>
                        <pre className='mt-2 max-h-24 overflow-hidden whitespace-pre-wrap text-[11px] text-bright/45'>
                            {recentOutput || lastBody || 'Expo output appears here after npm start.'}
                        </pre>
                    </div>
                </div>
            </div>
        </section>
    )
}
