type NewFileWarningProps = {
    treeHasFile: boolean
    lowercaseTreeHasFile: boolean
}

export default function NewFileWarning({ treeHasFile, lowercaseTreeHasFile }: NewFileWarningProps) {
    if (!treeHasFile && !lowercaseTreeHasFile) {
        return null
    }

    const warningColor = treeHasFile ? 'bg-red-500/50' : 'bg-yellow-500/50'
    const warning = treeHasFile
        ? 'This folder already contains a file or folder with this name. Please choose a different name, or remove the other file.'
        : 'This folder already contains a file or folder with this name, but with different casing. While this is allowed, it can cause issues on some operating systems, and may break git.'

    return (
        <div className={`absolute ${warningColor} mt-1 top-full right-0 text-xs rounded-md p-2 backdrop-blur-md`}>
            <h1>{warning}</h1>
        </div>
    )
}
