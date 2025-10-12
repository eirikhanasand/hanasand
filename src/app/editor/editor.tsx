'use client'

import { ChangeEvent, RefObject, useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import './editor.css'
import { postArticle } from '@/components/editor/postArticle'

type EditorProps = {
    article: string
    text: string[]
    customSaveLogic?: true
    hideSaveButton?: true
    save?: () => void
    onChange?: (value: string) => void
    className?: string
    placeholder?: string
    placeholderClassName?: string
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

marked.use({
    renderer: {
        code(token) {
            const language = hljs.getLanguage(typeof token.lang === 'string'
                ? token.lang : 'plaintext')
                ? token.lang
                || 'plaintext'
                : 'plaintext'
            const text = hljs.highlight(token.text, { language }).value
            const style = 'padding: 5px 10px; margin: 0;'
            const className = 'inline-block rounded-lg overflow-auto whitespace-pre-wrap break-words w-full'
            return `<pre class='${className}'><code style='${style}' class='hljs ${language}'>${text}</code></pre>`
        },
        image(token) {
            const width = 'width="300"'
            return `<img src='${token.href}' alt='${token.title}' ${width} />`
        },
        link(token) {
            const style = 'text-blue-500 underline'
            const rel = 'noopener noreferrer'
            return `<a href='${token.href}' title='${token.title}' target='_blank' rel='${rel}' class='${style}'>${token.text}</a>`
        },
        codespan(token) {
            return `<code class='break-all bg-extralight p-0.3 rounded-xs'>${token.text}</code>`
        }
    }
})

export default function Editor({
    article,
    text,
    customSaveLogic,
    hideSaveButton,
    save,
    onChange,
    className,
    placeholder,
    placeholderClassName
}: EditorProps) {
    const [markdown, setMarkdown] = useState(text.join('\n'))
    const [displayEditor, setDisplayEditor] = useState(false)
    const [hideSave, setHideSave] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const edited = text.join('\n') !== markdown

    function handleMarkdownChange(event: ChangeEvent<HTMLTextAreaElement>) {
        if (customSaveLogic && onChange) {
            if (!displayEditor) {
                setDisplayEditor(true)
            }

            onChange(event.target.value)
            setMarkdown(event.target.value)
        } else {
            setMarkdown(event.target.value)
        }

        setDisplayEditor(true)
        autoResize(event.target)
    }

    function handleSave() {
        if (customSaveLogic && save) {
            save()
        } else {
            postArticle(article, markdown.split('\n'))
        }

        setDisplayEditor(false)
        setHideSave(true)
    }

    function autoResize(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
    }

    function handleDisplayEditor() {
        setDisplayEditor(!displayEditor)
        setHideSave(false)
        if (textareaRef.current) {
            autoResize(textareaRef.current)
        }
    }

    useEffect(() => {
        if (textareaRef.current) {
            autoResize(textareaRef.current)
        }
    }, [])

    useEffect(() => {
        setMarkdown(text.join('\n'))
    }, [text])

    return <EditorWithoutLogic
        className={className}
        placeholder={placeholder}
        markdown={markdown}
        handleMarkdownChange={handleMarkdownChange}
        handleSave={handleSave}
        displayEditor={displayEditor}
        handleDisplayEditor={handleDisplayEditor}
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
            <div className=''>
                {displayEditor && <div className='grid grid-cols-2'>
                    <h1 className='text-lg text-almostbright'>Markdown</h1>
                    <h1 className='text-lg pl-2 text-almostbright'>Preview</h1>
                </div>}
                <div className={`markdown-editor space-x-2 h-full ${displayEditor && 'grid grid-cols-2'}`}>
                    {(displayEditor || !markdown.length) && <textarea
                        className={`w-full h-full rounded-sm text-white bg-transparent focus:outline-hidden resize-none overflow-hidden outline-hidden caret-orange-500 ${placeholderClassName}`}
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
                    className='text-md bg-login px-8 rounded-xl h-[4vh]'
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
            className={`markdown-preview ${displayEditor && 'pl-2 border-l-2 border-orange-500'} text-foreground h-full break-words ${className}`}
            onClick={handleDisplayEditor}
            dangerouslySetInnerHTML={{ __html: marked(markdown) }}
        />
    )
}
