'use client'

import ErrorNotice from '@/components/error/errorNotice'
import { Check, Copy, ExternalLink, ImageIcon, LoaderCircle, Upload } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadRecentUploads, RecentUpload } from '@/utils/upload/storage'
import prettyDate from '@/utils/date/prettyDate'
import { getUserFiles } from '@/utils/files/getUserFiles'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function Page() {
    const [uploads, setUploads] = useState<RecentUpload[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const { condition: copiedUrl, setCondition: setCopiedUrl } = useClearStateAfter({
        initialState: null,
        timeout: 1000,
        onClear: () => setCopiedUrl(null)
    })

    useEffect(() => {
        let mounted = true

        async function loadUploads() {
            setLoading(true)
            setLoadError(null)
            try {
                const localUploads = loadRecentUploads()
                const serverUploads = await getUserFiles()
                const mappedServerUploads = serverUploads.map((upload) => ({
                    url: `${config.url.cdn}/files/${upload.path ? `path/${upload.path}` : upload.id}`,
                    createdAt: upload.uploaded_at
                }))
                const mergedUploads = [...mappedServerUploads, ...localUploads]
                    .filter((upload, index, list) => list.findIndex((item) => item.url === upload.url) === index)
                    .slice(0, 60)

                if (mounted) {
                    setUploads(mergedUploads)
                }
            } catch (error) {
                if (mounted) {
                    setLoadError(error instanceof Error ? error.message : 'Unable to load upload history.')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        void loadUploads()

        return () => {
            mounted = false
        }
    }, [])

    function copyUploadLink(url: string) {
        navigator.clipboard.writeText(url)
            .then(() => setCopiedUrl(url))
            .catch(() => setCopiedUrl(`error:${url}`))
    }

    return (
        <section className='grid min-h-[90.5vh] gap-6 px-4 py-8 md:px-12 lg:px-24'>
            <div className='flex items-center justify-between gap-4'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <ImageIcon className='h-5 w-5 text-orange-300' />
                        <h1 className='text-2xl font-semibold'>Gallery</h1>
                    </div>
                    <p className='text-sm text-bright/55'>Your recent uploads</p>
                </div>
                <Link href='/upload' className='flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/70 hover:bg-white/8'>
                    <Upload className='h-4 w-4' />
                    Upload
                </Link>
            </div>

            {loadError ? <ErrorNotice compact message={loadError} /> : null}

            {loading && (
                <div className='grid min-h-64 place-items-center rounded-xl border border-white/10 bg-white/[0.025] text-center'>
                    <div className='grid gap-3'>
                        <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/5'>
                            <LoaderCircle className='h-5 w-5 animate-spin text-orange-300' />
                        </div>
                        <p className='text-sm text-bright/55'>Loading upload history...</p>
                    </div>
                </div>
            )}

            {!loading && !uploads.length && (
                <div className='grid min-h-64 place-items-center rounded-xl border border-dashed border-white/10 bg-white/4 text-center'>
                    <div className='grid gap-3'>
                        <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/5'>
                            <ImageIcon className='h-5 w-5 text-orange-300' />
                        </div>
                        <div className='grid gap-2'>
                            <p className='text-sm text-bright/55'>No uploads saved here yet.</p>
                            <Link href='/upload' className='mx-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-bright/65 transition hover:bg-white/8 hover:text-bright'>
                                <Upload className='h-4 w-4' />
                                Upload a file
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {!loading && uploads.length > 0 && (
                <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                    {uploads.map((upload) => (
                        <article
                            key={upload.url}
                            className='grid gap-3 rounded-xl border border-white/10 bg-white/4 p-3 transition hover:bg-white/7'
                        >
                            <div className='aspect-4/3 overflow-hidden rounded-lg bg-black/20'>
                                <img src={upload.url} alt='Recent upload' className='h-full w-full object-cover' />
                            </div>
                            <div className='flex items-center justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-bright/88'>{upload.url}</div>
                                    <div className='text-xs text-bright/45'>{prettyDate(upload.createdAt)}</div>
                                </div>
                                <div className='flex shrink-0 items-center gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => copyUploadLink(upload.url)}
                                        className={`grid h-9 w-9 place-items-center rounded-lg border transition cursor-pointer ${
                                            copiedUrl === upload.url
                                                ? 'border-green-400/35 bg-green-500/15 text-green-200'
                                                : 'border-white/10 bg-white/5 text-bright/60 hover:bg-white/10 hover:text-bright/85'
                                        }`}
                                        aria-label='Copy upload link'
                                    >
                                        {copiedUrl === upload.url ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                                    </button>
                                    <a
                                        href={upload.url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-bright/60 transition hover:bg-white/10 hover:text-bright/85'
                                        aria-label='Open upload'
                                    >
                                        <ExternalLink className='h-4 w-4' />
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}
