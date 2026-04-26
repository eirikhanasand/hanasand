'use client'

import { ChangeEvent, Dispatch, RefObject, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import '@styles/github.css'
import './editor.css'
import { postArticle } from '@/utils/articles/postArticle'
import { configureMarkdownRenderer, renderMarkdown } from './markdownRenderer'

type EditorProps = {
    id: string
    content: string[]
    customSaveLogic?: true
    hideSaveButton?: true
    save?: () => void
    onChange?: (value: string) => void
    className?: string
    placeholder?: string
    placeholderClassName?: string
    editing: boolean
    setEditing?: Dispatch<SetStateAction<boolean>>
}

type EditorWithoutLogicProps = {
    markdown: string
    handleMarkdownChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
    handleSave: () => void
    displayEditor: boolean
    hideSaveButton?: true
    handleDisplayEditor: () => void
    hideSave: boolean
    textareaRef: RefObject<HTMLTextAreaElement | null>
    edited: boolean
    className?: string
    placeholder?: string
    placeholderClassName?: string
}

type MarkdownProps = {
    displayEditor: boolean
    handleDisplayEditor: () => void
    markdown: string
    className?: string
}

configureMarkdownRenderer()

export default function Editor({
    id,
    content,
    customSaveLogic,
    hideSaveButton,
    save,
    onChange,
    className,
    placeholder,
    placeholderClassName,
    editing,
    setEditing
}: EditorProps) {
    const initialMarkdown = useMemo(() => content.join('\n'), [content])
    const [draftMarkdown, setDraftMarkdown] = useState(initialMarkdown)
    const [displayEditor, setDisplayEditor] = useState(false)
    const [hideSave, setHideSave] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const markdown = customSaveLogic
        ? initialMarkdown
        : (displayEditor || draftMarkdown !== initialMarkdown ? draftMarkdown : initialMarkdown)
    const edited = initialMarkdown !== markdown

    function handleMarkdownChange(event: ChangeEvent<HTMLTextAreaElement>) {
        if (customSaveLogic && onChange) {
            if (!displayEditor) {
                setDisplayEditor(true)
            }

            onChange(event.target.value)
        } else {
            setDraftMarkdown(event.target.value)
        }

        setDisplayEditor(true)
        autoResize(event.target)
    }

    function handleSave() {
        if (customSaveLogic && save) {
            save()
        } else {
            postArticle(id, markdown)
        }

        setDisplayEditor(false)
        setHideSave(true)
    }

    function autoResize(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
    }

    function handleDisplayEditor(next?: boolean | ((prev: boolean) => boolean)) {
        setDisplayEditor((prev) => {
            if (typeof next === 'function') {
                return next(prev)
            }

            return next ?? !prev
        })
        setHideSave(false)
        if (textareaRef.current) {
            autoResize(textareaRef.current)
        }
    }

    useEffect(() => {
        if (textareaRef.current) {
            autoResize(textareaRef.current)
        }
    }, [markdown, displayEditor])

    useEffect(() => {
        if (typeof setEditing !== 'undefined') {
            setEditing(displayEditor)
        }
    }, [displayEditor, setEditing])

    return <EditorWithoutLogic
        className={className}
        placeholder={placeholder}
        markdown={markdown}
        handleMarkdownChange={handleMarkdownChange}
        handleSave={handleSave}
        displayEditor={editing ? displayEditor : false}
        handleDisplayEditor={() => handleDisplayEditor((prev) => !prev)}
        hideSaveButton={hideSaveButton}
        hideSave={hideSave}
        textareaRef={textareaRef}
        edited={edited}
        placeholderClassName={placeholderClassName}
    />
}

export function EditorWithoutLogic({
    markdown,
    handleMarkdownChange,
    handleSave,
    displayEditor,
    handleDisplayEditor,
    hideSaveButton,
    hideSave,
    textareaRef,
    edited,
    className,
    placeholder,
    placeholderClassName
}: EditorWithoutLogicProps) {
    return (
        <div
            className={`${className}`}
            onClick={() => textareaRef?.current?.focus()}
        >
            <div>
                {displayEditor && <div className='grid grid-cols-2 bg-dark rounded-lg p-2 mb-2'>
                    <h1 className='text-lg font-semibold text-almostbright'>Markdown</h1>
                    <h1 className='text-lg font-semibold pl-2 text-almostbright'>Preview</h1>
                </div>}
                <div className={`markdown-editor space-x-2 h-full ${displayEditor && 'grid grid-cols-2'}`}>
                    {(displayEditor || !markdown.length) && <textarea
                        className={`z-10 w-full h-full rounded-sm text-foreground bg-transparent focus:outline-hidden resize-none overflow-hidden outline-hidden caret-blue-500 pr-2 ${placeholderClassName}`}
                        value={markdown}
                        onChange={handleMarkdownChange}
                        placeholder={placeholder || 'Write your markdown here...'}
                        ref={textareaRef}
                    />}
                    <Markdown
                        displayEditor={displayEditor}
                        handleDisplayEditor={handleDisplayEditor}
                        markdown={markdown}
                    />
                </div>
            </div>
            {edited && !hideSave && !hideSaveButton && <div className='mt-2'>
                <button
                    className='text-md bg-blue-500 glow-blue-small px-8 rounded-xl h-[4vh]'
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>}
        </div>
    )
}

export function Markdown({
    displayEditor,
    handleDisplayEditor,
    markdown,
    className
}: MarkdownProps) {
    return (
        <div
            className={`markdown-preview ${displayEditor && 'pl-2 border-l-2 border-blue-500'} text-foreground h-full break-words ${className}`}
            onClick={handleDisplayEditor}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
    )
}
