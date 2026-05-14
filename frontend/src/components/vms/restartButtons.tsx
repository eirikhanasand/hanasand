'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import manageVM from '@/utils/vms/fetch/manage/manage'
import { Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ErrorNotice from '../error/errorNotice'

export default function RestartButtons({ vm, forceVisible = false }: { vm: VM, forceVisible?: boolean }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [loading, setLoading] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const status = (vm.status || '').toLowerCase()
    const isRunning = status !== '' && status !== 'stopped' && status !== 'unknown'
    const canManage = Boolean(vm.name)
    const disabled = loading || !hydrated

    useEffect(() => {
        setHydrated(true)
    }, [])

    async function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault()
        e.stopPropagation()
    }

    async function handleRestart() {
        if (!canManage) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        setLoading(true)
        const response = await manageVM(vm.name, 'restart')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    async function handleStart() {
        if (!canManage) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        setLoading(true)
        const response = await manageVM(vm.name, 'start')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    async function handleStop() {
        if (!canManage) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        setLoading(true)
        const response = await manageVM(vm.name, 'stop')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div onClick={handleClick} className={`${forceVisible ? 'flex' : 'flex'} min-w-0 flex-col items-end gap-2 rounded-md`}>
            <div className='flex h-9 items-center justify-end gap-1'>
                {!isRunning && <button type='button' aria-label={`Start ${vm.name}`} onClick={handleStart} disabled={disabled} className='grid h-9 w-9 place-items-center rounded-md text-green-300 transition hover:bg-bright/5 disabled:cursor-wait disabled:opacity-50'>
                    <Play className='w-4 h-4' />
                </button>}
                {isRunning && <button type='button' aria-label={`Restart ${vm.name}`} onClick={handleRestart} disabled={disabled} className='grid h-9 w-9 place-items-center rounded-md text-blue-300 transition hover:bg-bright/5 disabled:cursor-wait disabled:opacity-50'>
                    <RefreshCcw className='w-4 h-4' />
                </button>}
                {isRunning && <button type='button' aria-label={`Stop ${vm.name}`} onClick={handleStop} disabled={disabled} className='grid h-9 w-9 place-items-center rounded-md text-red-300 transition hover:bg-bright/5 disabled:cursor-wait disabled:opacity-50'>
                    <StopCircle className='w-4 h-4' />
                </button>}
            </div>
            <ErrorNotice compact variant='info' className='max-w-sm text-left' message={message as string | null} />
        </div>
    )
}
