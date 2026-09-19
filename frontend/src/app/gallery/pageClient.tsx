'use client'

import { Copy, ExternalLink, FileIcon, ImageIcon, LoaderCircle, Upload } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getUserFiles, UserUpload } from '@/utils/files/getUserFiles'
import config from '@/config'

const pageSize = 30
export default function GalleryPageClient() {
    const [files, setFiles] = useState<UserUpload[]>([])
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState('')
    const [retry, setRetry] = useState(0)
    useEffect(() => {
        let current = true
        setLoading(true)
        setError('')
        getUserFiles(pageSize + 1, (page - 1) * pageSize)
            .then(data => { if (current) setFiles(data) })
            .catch(reason => { if (current) setError(reason.message || 'Your files could not be loaded.') })
            .finally(() => { if (current) setLoading(false) })
        return () => { current = false }
    }, [page, retry])
    const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold hover:border-ui-primary disabled:opacity-40'
    return <section className='mx-auto grid w-full max-w-7xl gap-6 p-4 text-ui-text md:p-6'>
        <header className='flex flex-wrap items-center justify-between gap-4'>
            <div><p className='text-sm text-ui-muted'>Content</p><h1 className='text-2xl font-semibold'>Library</h1><p className='mt-1 text-sm text-ui-muted'>Your uploaded files and shareable links.</p></div>
            <Link href='/upload' className={button}><Upload size={16} />Upload files</Link>
        </header>
        {loading ? <div role='status' className='flex justify-center gap-2 py-16 text-ui-muted'><LoaderCircle className='animate-spin' />Loading your files…</div>
            : error ? <div role='alert' className='rounded-lg border border-ui-border bg-ui-panel p-6'><p>{error}</p><button className={button + ' mt-3'} onClick={() => setRetry(retry + 1)}>Try again</button></div>
                : !files.length ? <div className='grid justify-items-center gap-3 rounded-lg border border-dashed border-ui-border p-12 text-center'><ImageIcon /><h2 className='font-semibold'>No files yet</h2><p className='text-sm text-ui-muted'>Upload a file to start your library.</p><Link className={button} href='/upload'>Upload a file</Link></div>
                    : <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                        {files.slice(0, pageSize).map(file => {
                            const url = `${config.url.cdn}/files/${encodeURIComponent(file.id)}`
                            return <article key={file.id} className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                                <div className='grid aspect-video place-items-center overflow-hidden bg-ui-raised'>
                                    {file.type.startsWith('image/') ? <img src={url} alt={file.name} loading='lazy' className='h-full w-full object-contain' />
                                        : file.type.startsWith('video/') ? <video src={url} controls preload='metadata' className='h-full w-full object-contain' />
                                            : <FileIcon className='h-10 w-10 text-ui-muted' />}
                                </div>
                                <div className='grid gap-3 p-4'><h2 className='truncate font-semibold' title={file.name}>{file.name}</h2>
                                    <p className='text-xs text-ui-muted'>{new Date(file.uploaded_at).toLocaleDateString()} · {file.size_bytes == null ? file.type : `${(Number(file.size_bytes) / 1024 / 1024).toFixed(1)} MB`}</p>
                                    <div className='flex gap-2'><button className={button} aria-label={`Copy link to ${file.name}`} onClick={async () => {
                                        try { await navigator.clipboard.writeText(url); setCopied(file.id) } catch { setCopied('error') }
                                    }}><Copy size={16} />{copied === file.id ? 'Copied' : 'Copy link'}</button>
                                    <a href={url} target='_blank' rel='noopener noreferrer' className={button}><ExternalLink size={16} />Open</a></div>
                                </div>
                            </article>
                        })}
                    </div>}
        {copied === 'error' && <p role='alert'>The link could not be copied. Open the file to copy its address.</p>}
        {!error && (page > 1 || files.length > pageSize) && <nav aria-label='Library pages' className='flex items-center justify-center gap-4'>
            <button className={button} disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className='text-sm'>Page {page}</span><button className={button} disabled={loading || files.length <= pageSize} onClick={() => setPage(page + 1)}>Next</button>
        </nav>}
    </section>
}
