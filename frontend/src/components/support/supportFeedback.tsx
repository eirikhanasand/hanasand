'use client'

import { Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'

export type Feedback = { feedback_rating?: number | null; feedback_comment?: string | null; resolution_version?: number; has_response?: boolean; close_feedback_found?: boolean | null }

export function SupportStars({ rating }: { rating: number }) {
    return <span aria-label={`${rating} out of 5 stars`} className='inline-flex items-center gap-0.5 text-amber-500'>{[1, 2, 3, 4, 5].map(star => <Star key={star} aria-hidden='true' className={`h-3.5 w-3.5 ${star <= rating ? 'fill-current' : 'opacity-30'}`} />)}</span>
}

export default function SupportFeedback({ feedback, submit }: { feedback: Feedback; submit: (rating: number, comment: string) => Promise<void> }) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [submitted, setSubmitted] = useState<Feedback | null>(null)
    const displayed = feedback.feedback_rating ? feedback : submitted
    if (displayed?.feedback_rating) return <div className='grid gap-2 text-sm text-ui-muted'><p className='font-medium text-ui-text'>Chat resolved</p><SupportStars rating={displayed.feedback_rating} /><p>Thank you for your feedback.</p>{displayed.feedback_comment ? <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{displayed.feedback_comment}</p> : null}{saving ? <p role='status' className='text-xs'>Sending feedback…</p> : null}</div>
    return <form className='grid gap-3' onSubmit={async event => {
        event.preventDefault()
        if (!rating || saving) return
        const text = rating <= 3 ? comment.trim() : ''
        flushSync(() => { setSaving(true); setError(''); setSubmitted({ feedback_rating: rating, feedback_comment: text }) })
        try { await submit(rating, text) } catch (error) { setSubmitted(null); setError(error instanceof Error ? error.message : 'Could not save feedback. Please try again.') } finally { setSaving(false) }
    }}>
        <div><p className='text-sm font-semibold text-ui-text'>Chat resolved</p><p className='mt-1 text-xs text-ui-muted'>How was your support experience?</p></div>
        <div role='group' aria-label='Rate your support experience' className='flex gap-1'>{[1, 2, 3, 4, 5].map(star => <button key={star} type='button' aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`} aria-pressed={rating === star} disabled={saving} onClick={() => setRating(star)} className='rounded-lg p-2 text-amber-500 hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary disabled:opacity-50'><Star aria-hidden='true' className={`h-6 w-6 ${star <= rating ? 'fill-current' : ''}`} /></button>)}</div>
        {rating > 0 && rating <= 3 ? <label className='grid gap-1.5 text-xs text-ui-muted'>What could we improve? (optional)<textarea aria-label='Feedback' rows={3} maxLength={2000} disabled={saving} value={comment} onChange={event => setComment(event.target.value)} className='min-w-0 resize-none rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary' /></label> : null}
        {error ? <p role='alert' className='text-xs text-ui-text'>{error}</p> : null}
        <button type='submit' disabled={!rating || saving} className='w-fit rounded-lg bg-ui-primary px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{saving ? 'Saving…' : 'Send feedback'}</button>
    </form>
}

export function GuestSupportFeedback({ feedback, submit, submitCloseFeedback, onNewChat }: { feedback: Feedback; submit: (rating: number, comment: string) => Promise<void>; submitCloseFeedback: (foundWhatLookingFor: boolean, reason?: string) => Promise<void>; onNewChat: () => void }) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)
    const [closeStep, setCloseStep] = useState<'question' | 'reason' | 'done'>(feedback.has_response === false && feedback.close_feedback_found == null ? 'question' : 'done')
    const [questionLeaving, setQuestionLeaving] = useState(false)
    const [closeReason, setCloseReason] = useState('')
    const [closeSaving, setCloseSaving] = useState(false)
    const [closeError, setCloseError] = useState('')
    const displayedRating = feedback.feedback_rating || (sent ? rating : 0)
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!rating || saving) return
        setSaving(true); setError('')
        try {
            await submit(rating, rating <= 4 ? comment.trim() : '')
            setSent(true)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save your feedback. Please try again.')
        } finally { setSaving(false) }
    }
    async function answerCloseQuestion(found: boolean) {
        if (closeSaving) return
        setCloseSaving(true); setCloseError('')
        try {
            await submitCloseFeedback(found)
            if (found) setCloseStep('done')
            else {
                setQuestionLeaving(true)
                window.setTimeout(() => { setCloseStep('reason'); setQuestionLeaving(false) }, 220)
            }
        } catch (cause) {
            setCloseError(cause instanceof Error ? cause.message : 'Could not save your answer. Please try again.')
        } finally { setCloseSaving(false) }
    }
    async function saveCloseReason(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!closeReason.trim()) { setCloseStep('done'); return }
        setCloseSaving(true); setCloseError('')
        try { await submitCloseFeedback(false, closeReason.trim()); setCloseStep('done') }
        catch (cause) { setCloseError(cause instanceof Error ? cause.message : 'Could not save your reason. Please try again.') }
        finally { setCloseSaving(false) }
    }
    if (feedback.has_response === false) return <div className='animate-[support-panel-enter_280ms_cubic-bezier(0.22,1,0.36,1)_both]'>
        {closeStep === 'question' ? <div className={`grid justify-items-center gap-4 text-center transition-all duration-200 ${questionLeaving ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`}>
            <h2 className='text-lg font-semibold tracking-tight text-ui-text'>Did you find what you were looking for?</h2>
            <div className='flex gap-3'><button type='button' disabled={closeSaving} onClick={() => void answerCloseQuestion(true)} className='rounded-lg border border-ui-border bg-ui-raised px-5 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-panel disabled:opacity-50'>Yes</button><button type='button' disabled={closeSaving} onClick={() => void answerCloseQuestion(false)} className='rounded-lg border border-ui-border bg-ui-raised px-5 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-panel disabled:opacity-50'>No</button></div>
            {closeSaving ? <p role='status' className='text-xs text-ui-muted'>Saving…</p> : null}
            {closeError ? <p role='alert' className='text-xs text-ui-text'>{closeError}</p> : null}
        </div> : closeStep === 'reason' ? <form className='grid justify-items-center gap-3 text-center animate-[support-panel-enter_220ms_ease-out_both]' onSubmit={saveCloseReason}>
            <h2 className='text-lg font-semibold tracking-tight text-ui-text'>What were you looking for?</h2>
            <label className='grid w-full gap-1.5 text-left text-xs text-ui-muted'>Your reason (optional)<textarea aria-label='Reason' rows={4} maxLength={2000} disabled={closeSaving} value={closeReason} onChange={event => setCloseReason(event.target.value)} className='min-w-0 resize-y rounded-xl border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/10' /></label>
            {closeError ? <p role='alert' className='text-xs text-ui-text'>{closeError}</p> : null}
            <div className='flex w-full items-center justify-between gap-3'><button type='button' disabled={closeSaving} onClick={() => setCloseStep('done')} className='rounded-lg px-3 py-2 text-sm text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Skip</button><button type='submit' disabled={closeSaving} className='rounded-lg border border-ui-border bg-ui-raised px-4 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-panel disabled:opacity-50'>{closeSaving ? 'Saving…' : 'Submit'}</button></div>
        </form> : <div className='grid justify-items-center gap-3 text-center'><p className='text-base font-semibold text-ui-text'>{feedback.close_feedback_found === true ? 'Thanks for letting us know you found what you needed.' : 'Thank you for letting us know.'}</p><button type='button' onClick={onNewChat} className='rounded-lg border border-ui-border bg-ui-raised px-4 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-panel'>Start a new chat</button></div>}
    </div>
    return <div className='animate-[support-panel-enter_280ms_cubic-bezier(0.22,1,0.36,1)_both]'>
        {displayedRating ? <div className='grid justify-items-center gap-3 text-center'>
            <p className='text-base font-semibold text-ui-text'>Thank you for your feedback.</p>
            <SupportStars rating={displayedRating} />
            {feedback.feedback_comment || sent && comment.trim() ? <p className='max-w-sm whitespace-pre-wrap text-sm text-ui-muted [overflow-wrap:anywhere]'>{feedback.feedback_comment || comment.trim()}</p> : null}
            <button type='button' onClick={onNewChat} className='mt-1 rounded-lg border border-ui-border bg-ui-raised px-4 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-panel'>Start a new chat</button>
        </div> : <form className='grid justify-items-center gap-3 text-center' onSubmit={save}>
            <div><h2 className='text-lg font-semibold tracking-tight text-ui-text'>How satisfied were you with our support?</h2><p className='mt-1 text-sm text-ui-muted'>Your feedback helps us improve.</p></div>
            <div role='group' aria-label='Rate your support experience' className='flex gap-1'>{[1, 2, 3, 4, 5].map(star => <button key={star} type='button' aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`} aria-pressed={rating === star} disabled={saving} onClick={() => setRating(star)} className='rounded-lg p-2 text-amber-500 transition duration-150 hover:scale-110 hover:bg-ui-raised active:scale-95 focus-visible:outline-2 focus-visible:outline-ui-primary disabled:opacity-50'><Star aria-hidden='true' className={`h-7 w-7 transition-transform duration-150 ${star <= rating ? 'fill-current' : ''}`} /></button>)}</div>
            {rating > 0 && rating <= 4 ? <label className='grid w-full gap-1.5 text-left text-xs text-ui-muted animate-[support-panel-enter_180ms_ease-out_both]'>What could we have done better? (optional)<textarea aria-label='Feedback' rows={4} maxLength={2000} disabled={saving} value={comment} onChange={event => setComment(event.target.value)} className='min-w-0 resize-y rounded-xl border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/10' /></label> : null}
            {error ? <p role='alert' className='text-xs text-ui-text'>{error}</p> : null}
            <div className='flex w-full items-center justify-between gap-3'>
                <button type='button' onClick={onNewChat} className='rounded-lg px-3 py-2 text-sm text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Start a new chat</button>
                <button type='submit' disabled={!rating || saving} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:opacity-50'>{saving ? 'Saving...' : 'Send feedback'}</button>
            </div>
        </form>}
    </div>
}
