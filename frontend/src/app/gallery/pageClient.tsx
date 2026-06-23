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

export default function GalleryPageClient() {
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
        <section className='grid min-h-[calc(100vh-4.5rem)] gap-6 bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
            <div className='mx-auto grid w-full max-w-7xl gap-6'>
                <div className='flex items-center justify-between gap-4'>
                    <div className='grid gap-2'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Personal notebook</p>
                        <div className='flex items-center gap-3 text-[#171a21]'>
                            <ImageIcon className='h-5 w-5 text-[#3056d3]' />
                            <h1 className='text-3xl font-semibold'>Gallery</h1>
                        </div>
                        <p className='text-sm text-[#596170]'>Recent uploads and media utilities from the personal Hanasand lab.</p>
                    </div>
                    <Link href='/upload' className='flex items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:border-[#bdc7d5]'>
                        <Upload className='h-4 w-4' />
                        Upload
                    </Link>
                </div>

                {loadError ? <ErrorNotice compact message={loadError} /> : null}

                {loading && (
                    <div className='grid min-h-64 place-items-center rounded-lg border border-[#dfe5ee] bg-white text-center shadow-sm'>
                        <div className='grid gap-3'>
                            <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc]'>
                                <LoaderCircle className='h-5 w-5 animate-spin text-[#3056d3]' />
                            </div>
                            <p className='text-sm text-[#596170]'>Loading upload history...</p>
                        </div>
                    </div>
                )}

                {!loading && !uploads.length && (
                    <div className='grid min-h-64 place-items-center rounded-lg border border-dashed border-[#cfd7e4] bg-white text-center shadow-sm'>
                        <div className='grid gap-3'>
                            <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc]'>
                                <ImageIcon className='h-5 w-5 text-[#3056d3]' />
                            </div>
                            <div className='grid gap-2'>
                                <p className='text-sm text-[#596170]'>No uploads saved here yet.</p>
                                <Link href='/upload' className='mx-auto inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'>
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
                                className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-white p-3 shadow-sm transition hover:border-[#bdc7d5]'
                            >
                                <div className='aspect-4/3 overflow-hidden rounded-lg bg-[#eef1f5]'>
                                    <img src={upload.url} alt='Recent upload' className='h-full w-full object-cover' />
                                </div>
                                <div className='flex items-center justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-semibold text-[#171a21]'>{upload.url}</div>
                                        <div className='text-xs text-[#667085]'>{prettyDate(upload.createdAt)}</div>
                                    </div>
                                    <div className='flex shrink-0 items-center gap-2'>
                                        <button
                                            type='button'
                                            onClick={() => copyUploadLink(upload.url)}
                                            className={`grid h-9 w-9 place-items-center rounded-lg border transition cursor-pointer ${
                                                copiedUrl === upload.url
                                                    ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#147a3b]'
                                                    : 'border-[#d8dee9] bg-white text-[#667085] hover:border-[#bdc7d5] hover:text-[#171a21]'
                                            }`}
                                            aria-label='Copy upload link'
                                        >
                                            {copiedUrl === upload.url ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                                        </button>
                                        <a
                                            href={upload.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='grid h-9 w-9 place-items-center rounded-lg border border-[#d8dee9] bg-white text-[#667085] transition hover:border-[#bdc7d5] hover:text-[#171a21]'
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
            </div>
        </section>
    )
}
