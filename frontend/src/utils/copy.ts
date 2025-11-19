import { Dispatch, SetStateAction } from 'react'

type CopyProps = {
  text: string
  setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
  type?: 'link' | 'alias'
}

export default function copy({ type, text, setDidCopy }: CopyProps) {
    navigator.clipboard.writeText(text)
        .then(() => {
            setDidCopy(type || true)
        })
        .catch((error) => {
            console.log(error)
            setDidCopy(`error${type ? `-${type}` : '' }`)
        })
}
