'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, ServerCog } from 'lucide-react'
import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'
import postVM from '@/utils/vms/fetch/postVM'
import { getCookie } from '@/utils/cookies/cookies'

export default function ShareEntryClient() {
    const router = useRouter()
    const [projectName, setProjectName] = useState('hanasand-project')
    const [status, setStatus] = useState<string | null>(null)
    const [pending, setPending] = useState<'share' | 'project' | null>(null)

    async function createShare() {
        setPending('share')
        const id = randomId()
        router.push(`/s/${id}`)
    }

    async function createProject() {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            setStatus('You need to be signed in to create a project.')
            return
        }

        setPending('project')
        setStatus('Creating project workspace and VM...')
        try {
            const shareId = randomId()
            const normalizedName = projectName.trim() || `project-${shareId}`
            const vmName = normalizedName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 48) || `vm-${shareId.toLowerCase()}`

            const share = await postShare({
                includeTree: true,
                id: shareId,
                content: '',
                name: normalizedName,
                path: normalizedName,
                type: 'folder',
                token,
                userId,
            })
            if (!share) {
                throw new Error('Unable to create the project workspace.')
            }

            const vmResult = await postVM({ name: vmName })
            if (vmResult.status >= 400 && vmResult.status !== 409) {
                throw new Error(vmResult.message)
            }

            setStatus(`Project ready. Workspace ${shareId}, VM ${vmName}.`)
            router.push(`/s/${shareId}`)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to create the project.')
        } finally {
            setPending(null)
        }
    }

    return (
        <div className='mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-6xl items-center justify-center px-4 py-10 md:px-8'>
            <div className='grid w-full gap-4 lg:grid-cols-2'>
                <button type='button' disabled={Boolean(pending)} onClick={() => void createShare()} className='rounded-3xl bg-dark/35 p-6 text-left outline outline-dark transition-colors hover:bg-dark/45 disabled:opacity-60'>
                    <div className='inline-flex rounded-2xl bg-[#fd8738]/12 p-3 text-[#fd8738] outline outline-[#fd8738]/20'>
                        <FolderPlus className='h-5 w-5' />
                    </div>
                    <h1 className='mt-5 text-2xl font-semibold text-bright/92'>Create a share</h1>
                    <p className='mt-3 max-w-xl text-sm leading-6 text-bright/45'>
                        Start with a lightweight editor workspace right away. This is the fastest path when you just want to write or inspect files.
                    </p>
                </button>
                <div className='rounded-3xl bg-dark/35 p-6 outline outline-dark'>
                    <div className='inline-flex rounded-2xl bg-[#fd8738]/12 p-3 text-[#fd8738] outline outline-[#fd8738]/20'>
                        <ServerCog className='h-5 w-5' />
                    </div>
                    <h1 className='mt-5 text-2xl font-semibold text-bright/92'>Create a project</h1>
                    <p className='mt-3 text-sm leading-6 text-bright/45'>
                        Create a workspace plus a VM-backed project identity so the AI can keep building remotely instead of only on this machine.
                    </p>
                    <input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder='Project name'
                        className='mt-5 w-full rounded-2xl bg-dark/30 px-4 py-3 text-sm text-bright/88 outline outline-dark placeholder:text-bright/26'
                    />
                    <button type='button' disabled={Boolean(pending)} onClick={() => void createProject()} className='mt-4 inline-flex rounded-2xl bg-[#fd8738] px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60'>
                        {pending === 'project' ? 'Creating project...' : 'Create project'}
                    </button>
                </div>
            </div>
            {status ? (
                <div className='fixed bottom-4 left-1/2 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-dark/80 px-4 py-3 text-sm text-bright/88 outline outline-dark backdrop-blur'>
                    {status}
                </div>
            ) : null}
        </div>
    )
}
