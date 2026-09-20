'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'

export type Feedback = { feedback_rating?: number | null; feedback_comment?: string | null; resolution_version?: number }

export function SupportStars({ rating }: { rating: number }) {
    return <span aria-label={`${rating} out of 5 stars`} className='inline-flex items-center gap-0.5 text-amber-500'>{[1, 2, 3, 4, 5].map(star => <Star key={star} aria-hidden='true' className={`h-3.5 w-3.5 ${star <= rating ? 'fill-current' : 'opacity-30'}`} />)}</span>
}

export default function SupportFeedback({ feedback, submit }: { feedback: Feedback; submit: (rating: number, comment: string) => Promise<void> }) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    if (feedback.feedback_rating) return <div className='grid gap-2 text-sm text-ui-muted'><p className='font-medium text-ui-text'>Chat resolved</p><SupportStars rating={feedback.feedback_rating} /><p>Thank you for your feedback.</p>{feedback.feedback_comment ? <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{feedback.feedback_comment}</p> : null}</div>
    return <form className='grid gap-3' onSubmit={async event => {
        event.preventDefault()
        if (!rating || saving) return
        setSaving(true); setError('')
        try { await submit(rating, rating <= 3 ? comment.trim() : '') } catch (error) { setError(error instanceof Error ? error.message : 'Could not save feedback. Please try again.') } finally { setSaving(false) }
    }}>
        <div><p className='text-sm font-semibold text-ui-text'>Chat resolved</p><p className='mt-1 text-xs text-ui-muted'>How was your support experience?</p></div>
        <div role='group' aria-label='Rate your support experience' className='flex gap-1'>{[1, 2, 3, 4, 5].map(star => <button key={star} type='button' aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`} aria-pressed={rating === star} disabled={saving} onClick={() => setRating(star)} className='rounded-lg p-2 text-amber-500 hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary disabled:opacity-50'><Star aria-hidden='true' className={`h-6 w-6 ${star <= rating ? 'fill-current' : ''}`} /></button>)}</div>
        {rating > 0 && rating <= 3 ? <label className='grid gap-1.5 text-xs text-ui-muted'>What could we improve? (optional)<textarea aria-label='Feedback' rows={3} maxLength={2000} disabled={saving} value={comment} onChange={event => setComment(event.target.value)} className='min-w-0 resize-none rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary' /></label> : null}
        {error ? <p role='alert' className='text-xs text-ui-danger'>{error}</p> : null}
        <button type='submit' disabled={!rating || saving} className='w-fit rounded-lg bg-ui-primary px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{saving ? 'Saving…' : 'Send feedback'}</button>
    </form>
}
