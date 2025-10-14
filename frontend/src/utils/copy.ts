import { Dispatch, SetStateAction } from 'react'

type CopyProps = {
    text: string
    setDidCopy: Dispatch<SetStateAction<'error' | boolean>>
}

export default function copy({ text, setDidCopy }: CopyProps) {
    navigator.clipboard.writeText(text)
        .then(() => {
            setDidCopy(true)
        })
        .catch((error) => {
            console.log(error)
            setDidCopy('error')
        })
}
