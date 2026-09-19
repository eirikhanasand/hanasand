'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import manageVM from '@/utils/vms/fetch/manage/manage'
import { Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ErrorNotice from '../error/errorNotice'
import { vmActionStyle } from './actionStyle'

export default function RestartButtons({ vm, forceVisible = false, onUpdated }: { vm: VM, forceVisible?: boolean, onUpdated?: () => void }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [loading, setLoading] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const status = (vm.status || '').toLowerCase()
    const isRunning = status === 'running' || status === 'frozen'
    const canManage = Boolean(vm.name)
    const disabled = loading || !hydrated || Boolean(vm.deleted_at)

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
            onUpdated?.()
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
            onUpdated?.()
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
            onUpdated?.()
        }
        setLoading(false)
    }

    return (
        <div onClick={handleClick} className={`${forceVisible ? 'flex' : 'flex'} min-w-0 flex-col items-end gap-2 rounded-md`}>
            <div className='flex h-9 items-center justify-end gap-2'>
                {!isRunning && <button type='button' aria-label={`Start ${vm.name}`} title='Start VM' onClick={handleStart} disabled={disabled} className={`${vmActionStyle} w-9 text-ui-success`}>
                    <Play className='w-4 h-4' />
                </button>}
                {isRunning && <button type='button' aria-label={`Restart ${vm.name}`} title='Restart VM' onClick={handleRestart} disabled={disabled} className={`${vmActionStyle} w-9 text-ui-primary`}>
                    <RefreshCcw className='w-4 h-4' />
                </button>}
                {isRunning && <button type='button' aria-label={`Stop ${vm.name}`} title='Stop VM' onClick={handleStop} disabled={disabled} className={`${vmActionStyle} w-9 text-ui-danger`}>
                    <StopCircle className='w-4 h-4' />
                </button>}
            </div>
            <ErrorNotice compact variant='info' className='max-w-sm text-left' message={message as string | null} />
        </div>
    )
}
