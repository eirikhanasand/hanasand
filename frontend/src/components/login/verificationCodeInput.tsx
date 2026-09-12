'use client'

import { useEffect, useRef } from 'react'

export default function VerificationCodeInput({
    label = 'Verification code',
    value,
    setValue,
    disabled,
    onComplete,
}: {
    label?: string
    value: string
    setValue: (value: string) => void
    disabled: boolean
    onComplete: (code: string) => void | Promise<void>
}) {
    const inputsRef = useRef<Array<HTMLInputElement | null>>([])
    const submittedCodeRef = useRef('')
    const code = value.padEnd(6, ' ').slice(0, 6).split('')

    useEffect(() => {
        if (value.length < 6) {
            submittedCodeRef.current = ''
            return
        }
        if (disabled || submittedCodeRef.current === value) {
            return
        }

        submittedCodeRef.current = value
        void onComplete(value)
    }, [disabled, onComplete, value])

    function updateCode(nextValue: string, focusIndex?: number) {
        const normalized = nextValue.replace(/\D/g, '').slice(0, 6)
        setValue(normalized)
        if (focusIndex !== undefined) {
            requestAnimationFrame(() => inputsRef.current[Math.min(focusIndex, 5)]?.focus())
        }
    }

    return (
        <div className='grid gap-2'>
            <div className='grid grid-cols-6 gap-1.5'>
                {code.map((digit, index) => (
                    <input
                        key={index}
                        ref={(element) => { inputsRef.current[index] = element }}
                        type='text'
                        inputMode='numeric'
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        aria-label={`${label} digit ${index + 1}`}
                        value={digit.trim()}
                        disabled={disabled}
                        onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, '')
                            if (digits.length > 1) {
                                updateCode(`${value.slice(0, index)}${digits}${value.slice(index + digits.length)}`, index + digits.length)
                                return
                            }
                            updateCode(`${value.slice(0, index)}${digits}${value.slice(index + 1)}`, digits ? index + 1 : index)
                        }}
                        onPaste={(event) => {
                            event.preventDefault()
                            updateCode(event.clipboardData.getData('text'), 5)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !value[index] && index > 0) {
                                event.preventDefault()
                                updateCode(`${value.slice(0, index - 1)}${value.slice(index)}`, index - 1)
                            }
                            if (event.key === 'ArrowLeft' && index > 0) {
                                event.preventDefault()
                                inputsRef.current[index - 1]?.focus()
                            }
                            if (event.key === 'ArrowRight' && index < 5) {
                                event.preventDefault()
                                inputsRef.current[index + 1]?.focus()
                            }
                        }}
                        className='h-11 rounded-lg border border-ui-border bg-ui-panel text-center text-base font-semibold text-ui-text outline-none transition focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted'
                    />
                ))}
            </div>
        </div>
    )
}

