'use client'

import { ArrowRight, ImageIcon, Upload } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadRecentUploads, RecentUpload } from '@/utils/upload/storage'
import prettyDate from '@/utils/date/prettyDate'

export default function Page() {
    const [uploads, setUploads] = useState<RecentUpload[]>([])

    useEffect(() => {
        setUploads(loadRecentUploads())
    }, [])

    return (
        <section className='grid min-h-[90.5vh] gap-6 px-4 py-8 md:px-12 lg:px-24'>
            <div className='flex items-center justify-between gap-4'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <ImageIcon className='h-5 w-5 text-orange-300' />
                        <h1 className='text-2xl font-semibold'>Gallery</h1>
                    </div>
                    <p className='text-sm text-bright/55'>Recent uploads from this browser session. The next production step is server-backed history.</p>
                </div>
                <Link href='/upload' className='flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/70 hover:bg-white/8'>
                    <Upload className='h-4 w-4' />
                    Upload
                </Link>
            </div>

            {!uploads.length && (
                <div className='grid min-h-64 place-items-center rounded-xl border border-dashed border-white/10 bg-white/4 text-center'>
                    <div className='grid gap-3'>
                        <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/5'>
                            <ImageIcon className='h-5 w-5 text-orange-300' />
                        </div>
                        <p className='text-sm text-bright/55'>No uploads saved here yet.</p>
                    </div>
                </div>
            )}

            {uploads.length > 0 && (
                <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                    {uploads.map((upload) => (
                        <a
                            key={upload.url}
                            href={upload.url}
                            target='_blank'
                            rel='noreferrer'
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
                                <ArrowRight className='h-4 w-4 shrink-0 text-bright/35' />
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </section>
    )
}
