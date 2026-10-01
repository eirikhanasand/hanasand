'use client'

import config from '@/config'
import {
    clearActiveProfileCookies,
    clearSavedProfileSession,
    clearSavedProfiles,
    isSavedSessionExpired,
    readSavedProfiles,
    rememberCurrentProfile,
    restoreSavedProfile,
    type SavedProfile,
} from '@/utils/auth/savedProfiles'
import { ArrowLeft, ArrowRight, ArrowUpRight, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const cardClass = 'rounded-xl border border-ui-border bg-ui-panel shadow-sm'
const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'

export default function SwitchAccountPage() {
    const router = useRouter()
    const [currentProfile, setCurrentProfile] = useState<SavedProfile | null>(null)
    const [profiles, setProfiles] = useState<SavedProfile[]>([])
    const [ready, setReady] = useState(false)
    const [confirmForget, setConfirmForget] = useState(false)
    const [forgetting, setForgetting] = useState(false)

    useEffect(() => {
        const current = rememberCurrentProfile()
        setCurrentProfile(current)
        setProfiles(readSavedProfiles())
        setReady(true)
    }, [])

    function addProfile() {
        rememberCurrentProfile()
        clearActiveProfileCookies()
        window.location.assign('/login?path=%2Fswitch-account')
    }

    function goBack() {
        if (window.history.length > 1) {
            router.back()
            return
        }

        router.replace('/dashboard')
    }

    function switchTo(profile: SavedProfile) {
        if (isSavedSessionExpired(profile)) {
            clearSavedProfileSession(profile.id)
            clearActiveProfileCookies()
            const query = new URLSearchParams({ path: '/switch-account', username: profile.id })
            window.location.assign('/login?' + query.toString())
            return
        }

        rememberCurrentProfile()
        restoreSavedProfile(profile)
        window.location.assign('/dashboard')
    }

    async function forgetAllProfiles() {
        if (forgetting) return
        rememberCurrentProfile()
        const savedProfiles = readSavedProfiles()
        setForgetting(true)
        await Promise.allSettled(savedProfiles
            .filter(profile => profile.token)
            .map(profile => fetch(config.url.api + '/auth/logout/' + encodeURIComponent(profile.id), {
                headers: { Authorization: 'Bearer ' + profile.token },
                keepalive: true,
                signal: AbortSignal.timeout(config.abortTimeout),
            })))
        clearSavedProfiles()
        clearActiveProfileCookies()
        window.location.replace('/login')
    }

    const savedProfiles = profiles.filter(profile => profile.id !== currentProfile?.id)

    return (
        <section className='mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center overflow-y-auto px-4 py-10 text-ui-text sm:px-8'>
            <div className='w-full max-w-xl'>
                <header className='mb-6 flex items-center gap-4'>
                    <button type='button' onClick={goBack} className={secondaryButtonClass}>
                        <ArrowLeft className='h-4 w-4' />
                        Back
                    </button>
                    <h1 className='text-2xl font-semibold tracking-tight'>Choose an account</h1>
                </header>

                <div className={cardClass}>
                    {currentProfile && (
                        <div className='border-b border-ui-border p-4'>
                            <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-ui-muted'>Currently signed in</p>
                            <ProfileIdentity profile={currentProfile} current />
                        </div>
                    )}

                    {ready && savedProfiles.length > 0 && (
                        <div className='p-4'>
                            <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-ui-muted'>Saved profiles</p>
                            <div className='grid gap-2'>
                                {savedProfiles.map(profile => {
                                    const expired = isSavedSessionExpired(profile)
                                    return (
                                        <button
                                            key={profile.id}
                                            type='button'
                                            onClick={() => switchTo(profile)}
                                            aria-label={expired ? 'Sign in as ' + profile.id : 'Switch to ' + profile.name}
                                            className='flex min-h-16 items-center gap-3 rounded-lg border border-ui-border px-3 text-left transition hover:border-ui-primary hover:bg-ui-raised'
                                        >
                                            <ProfileAvatar profile={profile} />
                                            <span className='min-w-0 flex-1'>
                                                <span className='block truncate text-sm font-semibold'>{profile.name}</span>
                                                <span className='block truncate text-xs text-ui-muted'>@{profile.id}{expired ? ' · Sign in again' : ''}</span>
                                            </span>
                                            {expired ? <ArrowUpRight className='h-4 w-4 text-ui-muted' /> : <ArrowRight className='h-4 w-4 text-ui-muted' />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {!ready && <div className='p-5 text-sm text-ui-muted'>Loading profiles…</div>}

                    <div className='flex flex-col gap-3 border-t border-ui-border p-4 sm:flex-row sm:items-center'>
                        <button type='button' onClick={addProfile} className={secondaryButtonClass}>
                            <Plus className='h-4 w-4' />
                            Add profile
                        </button>
                        {ready && profiles.length > 0 && (
                            <button
                                type='button'
                                onClick={() => setConfirmForget(true)}
                                className='min-h-11 rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text sm:ml-auto'
                            >
                                Forget all profiles
                            </button>
                        )}
                    </div>
                </div>

                {confirmForget && (
                    <div role='alertdialog' aria-modal='true' aria-labelledby='forget-profiles-title' className='mt-4 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-lg'>
                        <h2 id='forget-profiles-title' className='font-semibold'>Forget all profiles?</h2>
                        <p className='mt-1 text-sm text-ui-muted'>This removes saved profiles from this browser and signs out their sessions here.</p>
                        <div className='mt-4 flex justify-end gap-2'>
                            <button type='button' disabled={forgetting} onClick={() => setConfirmForget(false)} className={secondaryButtonClass}>Cancel</button>
                            <button type='button' disabled={forgetting} onClick={forgetAllProfiles} className='min-h-11 rounded-lg bg-ui-danger px-4 text-sm font-semibold text-white disabled:opacity-60'>
                                {forgetting ? 'Forgetting…' : 'Forget all profiles'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

function ProfileIdentity({ profile, current }: { profile: SavedProfile, current?: boolean }) {
    return (
        <div className='flex items-center gap-3'>
            <ProfileAvatar profile={profile} />
            <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-semibold'>{profile.name}</span>
                <span className='block truncate text-xs text-ui-muted'>@{profile.id}</span>
            </span>
            {current && <span className='rounded-full bg-ui-raised px-2.5 py-1 text-xs font-medium text-ui-muted'>This account</span>}
        </div>
    )
}

function ProfileAvatar({ profile }: { profile: SavedProfile }) {
    return (
        <span className='grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-ui-border bg-ui-raised text-ui-muted'>
            {profile.avatar
                ? <img src={profile.avatar} alt='' className='h-full w-full object-cover' />
                : <UserRound className='h-5 w-5' />}
        </span>
    )
}
