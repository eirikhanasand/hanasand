'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ServerCog } from 'lucide-react'
import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'
import postVM from '@/utils/vms/fetch/postVM'
import getAgentTarget from '@/utils/vms/fetch/getAgentTarget'
import syncAgentTargetAccess from '@/utils/vms/fetch/syncAgentTargetAccess'
import { getCookie } from '@/utils/cookies/cookies'

export default function ShareEntryClient() {
    const router = useRouter()
    const [projectName, setProjectName] = useState('hanasand-project')
    const [status, setStatus] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function createProject() {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            setStatus('You need to be signed in to create a project.')
            return
        }

        setPending(true)
        setStatus('Creating project workspace...')
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

            setStatus('Provisioning VM backing for this project...')
            const vmResult = await postVM({ name: vmName })
            if (vmResult.status >= 400 && vmResult.status !== 409) {
                throw new Error(vmResult.message)
            }

            setStatus('Synchronizing VM access...')
            const syncResult = await syncAgentTargetAccess(vmName, 'current_user')
            if (syncResult.status >= 400 || !syncResult.body?.ok) {
                throw new Error(syncResult.message)
            }

            setStatus('Verifying VM target...')
            const targetResult = await getAgentTarget(vmName)
            if (targetResult.status >= 400 || !targetResult.target) {
                throw new Error(targetResult.message)
            }

            const readiness = targetResult.target.capabilities.canConnect
                ? targetResult.target.network.sshHost
                    ? `SSH ready at ${targetResult.target.network.sshHost}`
                    : 'SSH-capable and waiting for network details'
                : 'created and waiting for the VM to become connectable'

            setStatus(`Project ready. Workspace ${shareId}, VM ${vmName}, ${readiness}.`)
            router.push(`/s/${shareId}`)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to create the project.')
        } finally {
            setPending(false)
        }
    }

    return (
        <div className='mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-6xl items-center justify-center px-4 py-10 md:px-8'>
            <div className='w-full max-w-2xl rounded-3xl bg-dark/35 p-6 outline outline-dark'>
                <div>
                    <div className='inline-flex rounded-2xl bg-[#fd8738]/12 p-3 text-[#fd8738] outline outline-[#fd8738]/20'>
                        <ServerCog className='h-5 w-5' />
                    </div>
                    <h1 className='mt-5 text-2xl font-semibold text-bright/92'>Create a project workspace</h1>
                    <p className='mt-3 max-w-xl text-sm leading-6 text-bright/45'>
                        Every workspace on /s is now backed by the project system, so even a one-file workspace gets a project root, file tree, and VM target.
                    </p>
                    <p className='mt-4 text-xs uppercase tracking-[0.24em] text-bright/32'>
                        Project root, VM access, terminal ready
                    </p>
                    <input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder='Project name'
                        className='mt-5 w-full rounded-2xl bg-dark/30 px-4 py-3 text-sm text-bright/88 outline outline-dark placeholder:text-bright/26'
                    />
                    <button type='button' disabled={pending} onClick={() => void createProject()} className='mt-4 inline-flex rounded-2xl bg-[#fd8738] px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60'>
                        {pending ? 'Creating project...' : 'Create project'}
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
