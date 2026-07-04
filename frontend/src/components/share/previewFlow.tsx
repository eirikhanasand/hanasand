'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { AlertCircle, CheckCircle2, Clipboard, ExternalLink, Loader2, Play, RadioTower, TerminalSquare } from 'lucide-react'
import copy from '@/utils/copy'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getPreviewRuntime, previewHealthCopy, type PreviewHealth } from '@/utils/share/previewFlow'
import type { ShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'

type PreviewFlowProps = {
    share: Share | null
    tree: Tree | null
    activePath: string | null
    activeContent: string
    capability: ShareRuntimeCapability
    renderSite: boolean
    setTriggerSiteChange: Dispatch<SetStateAction<boolean | 'close'>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
}

export default function PreviewFlow({
    share,
    tree,
    activePath,
    activeContent,
    capability,
    renderSite,
    setTriggerSiteChange,
    setTriggerTerminalChange,
}: PreviewFlowProps) {
    const runtime = useMemo(() => getPreviewRuntime({
        share,
        tree,
        activePath,
        activeContent,
        capability,
    }), [activeContent, activePath, capability, share, tree])
    const [health, setHealth] = useState<PreviewHealth>('idle')
    const [lastError, setLastError] = useState<string | null>(null)
    const previewUrl = share?.alias ? `https://${share.alias}.hanasand.com${runtime.healthPath}` : null
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 900,
        onClear: () => setDidCopy(false),
    })

    useEffect(() => {
        if (!renderSite || !previewUrl || !runtime.canRun) {
            if (!runtime.canRun) {
                setHealth('idle')
                setLastError(null)
            }
            return
        }

        let cancelled = false
        const url = previewUrl
        setHealth('checking')

        async function probePreview() {
            const controller = new AbortController()
            const timeout = window.setTimeout(() => controller.abort(), 5000)

            try {
                await fetch(url, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal,
                })
                if (!cancelled) {
                    setHealth('reachable')
                    setLastError(null)
                }
            } catch {
                if (!cancelled) {
                    setHealth('unreachable')
                    setLastError(runtime.command
                        ? `Nothing answered at the preview URL. Start the app with ${runtime.command}.`
                        : runtime.action)
                }
            } finally {
                window.clearTimeout(timeout)
            }
        }

        void probePreview()
        const interval = window.setInterval(() => {
            void probePreview()
        }, 8000)

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [previewUrl, renderSite, runtime.action, runtime.canRun, runtime.command])

    function openPreview() {
        if (!runtime.canRun) {
            return
        }

        if (!renderSite) {
            setTriggerSiteChange(true)
        }
    }

    return (
        <section className={`flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs shadow-2xl shadow-ui-canvas/10 backdrop-blur-md ${runtime.canRun
            ? 'border-ui-primary/25 bg-ui-primary/10 text-ui-muted'
            : 'border-ui-border bg-ui-panel/70 text-ui-muted'
        }`}>
            <div className='flex min-w-0 flex-1 items-center gap-2'>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${runtime.canRun ? 'bg-ui-primary/15 text-ui-primary' : 'bg-ui-raised text-ui-muted'}`}>
                    {health === 'checking' ? <Loader2 className='h-4 w-4 animate-spin' /> : health === 'reachable' ? <CheckCircle2 className='h-4 w-4' /> : health === 'unreachable' ? <AlertCircle className='h-4 w-4' /> : <RadioTower className='h-4 w-4' />}
                </span>
                <div className='min-w-0'>
                    <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
                        <span className='font-semibold text-ui-text'>{runtime.canRun ? `${runtime.framework} preview` : runtime.framework}</span>
                        {runtime.command ? (
                            <code className='max-w-full truncate rounded-md border border-ui-border bg-ui-canvas px-1.5 py-0.5 font-mono text-[11px] text-ui-muted'>
                                {runtime.command}
                            </code>
                        ) : null}
                    </div>
                    <div className='mt-0.5 truncate text-[11px] leading-4 text-ui-muted'>
                        {lastError || previewHealthCopy(health, runtime)}
                    </div>
                </div>
            </div>
            <div className='flex shrink-0 items-center gap-1.5'>
                {runtime.command ? (
                    <button
                        type='button'
                        aria-label='Copy preview run command'
                        title='Copy run command'
                        onClick={() => copy({ text: runtime.command || '', setDidCopy })}
                        className='grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted transition hover:border-ui-primary hover:bg-ui-raised hover:text-ui-text'
                    >
                        {didCopy === true ? <CheckCircle2 className='h-4 w-4 text-ui-success' /> : <Clipboard className='h-4 w-4' />}
                    </button>
                ) : null}
                <button
                    type='button'
                    aria-label='Open terminal for preview command'
                    title='Open terminal'
                    onClick={() => setTriggerTerminalChange(true)}
                    className='grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted transition hover:border-ui-primary hover:bg-ui-raised hover:text-ui-text'
                >
                    <TerminalSquare className='h-4 w-4' />
                </button>
                {previewUrl && runtime.canRun ? (
                    <a
                        href={previewUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='Open preview in a new tab'
                        title='Open preview in new tab'
                        className='grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted transition hover:border-ui-primary hover:bg-ui-raised hover:text-ui-text'
                    >
                        <ExternalLink className='h-4 w-4' />
                    </a>
                ) : null}
                <button
                    type='button'
                    disabled={!runtime.canRun}
                    onClick={openPreview}
                    className='inline-flex h-8 items-center gap-2 rounded-lg bg-ui-primary px-3 text-[11px] font-bold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted'
                >
                    <Play className='h-3.5 w-3.5 fill-current' />
                    Preview
                </button>
            </div>
        </section>
    )
}
