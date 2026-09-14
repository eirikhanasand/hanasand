'use client'

import Image from 'next/image'
import { Check, Copy, Link as LinkIcon } from 'lucide-react'
import { useState } from 'react'

export default function PublicProfile({ profile, username }: { profile: User | null, username: string }) {
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)
    const [avatarFailed, setAvatarFailed] = useState(false)
    const inactive = profile?.active === false
    const displayName = inactive ? username : profile?.name || username
    const path = `/profile/${encodeURIComponent(username)}`
    const avatar = !inactive && profile?.avatar && /^(https?:\/\/|\/(?!\/))/.test(profile.avatar) ? profile.avatar : null
    const initials = displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

    async function copyProfile() {
        try {
            await navigator.clipboard.writeText(new URL(path, window.location.origin).href)
            setCopied(true)
            setCopyFailed(false)
        } catch {
            setCopyFailed(true)
        }
    }

    return (
        <article className='mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-sm'>
            <div aria-hidden='true' className='relative h-36 overflow-hidden bg-ui-primary/10 sm:h-48'>
                <div className='absolute inset-0 bg-linear-to-br from-ui-primary/20 via-transparent to-ui-primary/5' />
                <div className='absolute -right-12 -top-36 size-96 rounded-full border border-ui-primary/15 sm:right-10' />
                <div className='absolute -right-28 -top-20 size-96 rounded-full border border-ui-primary/15 sm:-right-6' />
                <div className='absolute -right-44 -top-4 size-96 rounded-full border border-ui-primary/15 sm:-right-22' />
            </div>
            <div className='relative px-6 pb-7 sm:px-10 sm:pb-9'>
                <div className='relative -mt-14 mb-5 flex items-end justify-between gap-4 sm:-mt-16'>
                    <div className='relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-[5px] border-ui-panel bg-ui-raised text-4xl font-semibold tracking-tight text-ui-primary shadow-sm sm:size-36 sm:text-5xl'>
                        {avatar && !avatarFailed
                            ? <Image src={avatar} alt={`${displayName}'s avatar`} fill unoptimized className='object-cover' onError={() => setAvatarFailed(true)} />
                            : <span aria-hidden='true'>{initials}</span>}
                    </div>
                    {profile && <span className='mb-1 flex items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 py-1 text-xs font-medium text-ui-muted'>
                        <span className={`size-1.5 rounded-full ${inactive ? 'bg-ui-warning' : 'bg-ui-success'}`} />
                        {inactive ? 'Inactive' : 'Member'}
                    </span>}
                </div>
                <h1 className='wrap-break-word text-3xl font-semibold tracking-tight text-ui-text sm:text-4xl'>{displayName}</h1>
                <p className='mt-1 break-all text-lg text-ui-muted'>@{username}</p>
                {!profile && <p role='status' className='mt-5 text-sm text-ui-muted'>Profile details are unavailable. Please try again.</p>}
                {inactive && <p className='mt-5 text-sm text-ui-muted'>This account is no longer active.</p>}
                <div className='mt-8 flex flex-col gap-4 border-t border-ui-border pt-5 sm:flex-row sm:items-center sm:justify-between'>
                    <a href={path} className='flex min-w-0 items-start gap-2 text-sm text-ui-muted transition-colors hover:text-ui-primary'>
                        <LinkIcon aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                        <span className='break-all'>hanasand.com/profile/{username}</span>
                    </a>
                    <button type='button' onClick={copyProfile} className='inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-ui-border bg-ui-raised px-4 py-2 text-sm font-medium text-ui-text transition-colors hover:border-ui-primary/40 hover:bg-ui-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>
                        {copied ? <Check aria-hidden='true' className='size-4 text-ui-success' /> : <Copy aria-hidden='true' className='size-4' />}
                        {copied ? 'Link copied' : 'Copy profile link'}
                    </button>
                </div>
                <p role='status' className='sr-only'>{copied ? 'Profile link copied to clipboard.' : ''}</p>
                {copyFailed && <p role='alert' className='mt-3 text-sm text-ui-muted'>Couldn’t copy the link. You can copy the profile address above.</p>}
            </div>
        </article>
    )
}
