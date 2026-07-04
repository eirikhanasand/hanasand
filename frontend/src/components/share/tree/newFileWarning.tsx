type NewFileWarningProps = {
    treeHasFile: boolean
    lowercaseTreeHasFile: boolean
}

export default function NewFileWarning({ treeHasFile, lowercaseTreeHasFile }: NewFileWarningProps) {
    if (!treeHasFile && !lowercaseTreeHasFile) {
        return null
    }

    const warningColor = treeHasFile ? 'border-ui-danger bg-ui-danger/10 text-ui-danger' : 'border-ui-warning bg-ui-warning/10 text-ui-warning'
    const warning = treeHasFile
        ? 'This folder already contains a file or folder with this name. Please choose a different name, or remove the other file.'
        : 'This folder already contains a file or folder with this name, but with different casing. While this is allowed, it can cause issues on some operating systems, and may break git.'

    return (
        <div className={`absolute right-0 top-full mt-1 rounded-md border p-2 text-xs backdrop-blur-md ${warningColor}`}>
            <h1>{warning}</h1>
        </div>
    )
}
